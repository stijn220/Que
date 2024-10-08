import os
import time
import logging
from threading import Thread
from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from flask_session import Session
from flask_socketio import SocketIO
import socket
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
import segno

load_dotenv()

# Flask application setup
app = Flask(__name__)
app.config["SECRET_KEY"] = os.urandom(64)
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_FILE_DIR"] = "./.flask_session/"
Session(app)

# Setup Flask-SocketIO
socketio = SocketIO(app)

# Spotify setup
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")
SCOPE = "user-read-playback-state user-library-read user-read-currently-playing user-modify-playback-state"

qr_file_path = 'static/images/qr.png'


cache_handler = spotipy.cache_handler.FlaskSessionCacheHandler(session)

sp_oauth = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=SCOPE,
    cache_handler=cache_handler,
)


class TokenManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TokenManager, cls).__new__(cls)
            cls._instance.token_info = None
        return cls._instance

    def set_token(self, token_info):
        self.token_info = token_info

    def get_token(self):
        return self.token_info

token_manager = TokenManager()

last_queue_call = {}
last_analyzed_track_id = None
last_audio_analysis = None

def refresh_token_if_expired():
    token_info = token_manager.get_token()
    if not token_info:
        return None

    # Refresh the token if it is expired
    if sp_oauth.is_token_expired(token_info):
        logging.info("Token expired, refreshing...")
        token_info = sp_oauth.refresh_access_token(token_info['refresh_token'])
        token_manager.set_token(token_info)  # Update with refreshed token
    return token_info

def get_spotify_client():
    token_info = refresh_token_if_expired()
    if not token_info or not token_info.get("access_token"):
        return None
    return spotipy.Spotify(auth=token_info["access_token"])

def handle_spotify_exception(e):
    logging.error(f"Spotify API exception: {e}")
    if e.http_status == 401:  # Unauthorized, likely due to expired token
        logging.info("Access token expired. Disconnecting user...")
        disconnect()
        return jsonify({"error": "Access token expired. Please re-authenticate."}), 401
    return jsonify({"error": str(e)}), e.http_status

def is_mobile_user_agent(user_agent):
    mobile_patterns = [
        "android",
        "webos",
        "iphone",
        "ipad",
        "ipod",
        "blackberry",
        "windows phone",
        "mobile",
    ]
    return any(pattern in user_agent.lower() for pattern in mobile_patterns)


@app.route("/")
def index():
    if not token_manager.get_token():
        return redirect(url_for("setup"))

    user_agent = request.headers.get("User-Agent", "")
    if is_mobile_user_agent(user_agent):
        return render_template("phone.html")
    else:
        return render_template("index.html")


@app.route("/phone")
def phone():
    return render_template("phone.html")


@app.route("/setup")
def setup():
    connected = token_manager.get_token() is not None
    return render_template("setup.html", connected=connected)


@app.route("/connect")
def connect():
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)


@app.route("/callback")
def callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "No code provided"}), 400

    try:
        token_info = sp_oauth.get_access_token(code)
        token_manager.set_token(token_info)
        return redirect(url_for("index"))
    except Exception as e:
        logging.error(f"Failed to authenticate: {str(e)}")
        return jsonify({"error": f"Failed to authenticate: {str(e)}"}), 400


@app.route("/disconnect")
def disconnect():
    session.pop("token_info", None)
    token_manager.set_token(None)
    return redirect(url_for("setup"))

@app.route('/initial_data')
def initial_data():
    global last_queue_call
    socketio.emit('update', last_queue_call)
    return 'Data sent to client', 200


@app.route("/search", methods=["GET"])
def search():
    sp = get_spotify_client()
    if sp is None:
        return jsonify({"error": "User not authenticated"}), 401

    query = request.args.get("q", "")
    if query:
        try:
            results = sp.search(q=query, type="track", limit=5)
            tracks = [
                {
                    "name": track["name"],
                    "artist": track["artists"][0]["name"],
                    "id": track["id"],
                    "image": track["album"]["images"][0]["url"]
                    if track["album"]["images"]
                    else "/static/images/no_cover.png",
                }
                for track in results["tracks"]["items"]
            ]
            return jsonify(tracks)
        except spotipy.exceptions.SpotifyException as e:
            return handle_spotify_exception(e)
    return jsonify([])


@app.route("/api/track/<track_id>")
def get_track_details(track_id):
    sp = get_spotify_client()
    if sp is None:
        return jsonify({"error": "User not authenticated"}), 401

    try:
        track = sp.track(track_id)
        track_info = {
            "name": track["name"],
            "artists": [{"name": artist["name"]} for artist in track["artists"]],
            "album": {
                "name": track["album"]["name"],
                "images": track["album"]["images"],
            },
            "duration_ms": track["duration_ms"],
        }
        return jsonify(track_info)
    except spotipy.exceptions.SpotifyException as e:
        return handle_spotify_exception(e)


@app.route("/api/add-to-queue", methods=["POST"])
def add_to_queue():
    sp = get_spotify_client()
    if sp is None:
        return jsonify({"error": "User not authenticated"}), 401

    track_id = request.json.get("track_id")
    if not track_id:
        return jsonify({"error": "Track ID is required"}), 400

    try:
        track_uri = f"spotify:track:{track_id}"
        sp.add_to_queue(track_uri)
        return jsonify({"success": "Track added to queue!"})
    except spotipy.exceptions.SpotifyException as e:
        return handle_spotify_exception(e)

    
@app.route('/qr')
def load_qr():
    global port, qr_file_path
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
    except Exception:
        local_ip = 'Unable to get IP'
    finally:
        s.close()
    
    local_url = f"http://{local_ip}:{port}"
    
    qr = segno.make(local_url)    
    qr.save(qr_file_path, scale=10, dark='black', light='#1db954')

    
    return render_template('qr.html', qr_image=qr_file_path, ip_address=local_url)
    
@app.route('/visuals')
def visuals():
    return render_template('visuals.html')


def background_data_fetch():
    global last_queue_call, last_analyzed_track_id, last_audio_analysis
    while True:
        try:
            sp = get_spotify_client()
            if sp:
                # Safeguard queue API call
                try:
                    queue_response = sp.queue()
                    queue = queue_response.get('queue', [])
                    currently_playing = queue_response.get('currently_playing', {})
                except Exception as e:
                    logging.warning(f"Failed to fetch queue or currently playing info: {e}")
                    queue = []
                    currently_playing = {}

                # Safeguard playback API call
                try:
                    playback = sp.currently_playing()
                    if playback and playback['item']:
                        track_id = playback['item']['id']
                        progress_ms = playback['progress_ms']
                        is_playing = playback['is_playing']
                        
                        
                        # Only fetch audio analysis if there's a new song
                        if track_id != last_analyzed_track_id:
                            logging.info(f"New track detected (ID: {track_id}), fetching analysis.")
                            try:
                                last_audio_analysis = sp.audio_analysis(track_id)
                                last_analyzed_track_id = track_id  # Update with the new track ID
                            except Exception as e:
                                logging.warning(f"Audio analysis failed: {e}")
                                last_audio_analysis = None  # Clear the analysis if the call fails
                        else:
                            logging.info("Same track is playing, using cached analysis.")
                    else:
                        logging.info("No track currently playing.")
                        playback = {}
                        track_id = None
                        last_audio_analysis = []
                        progress_ms = 0
                except Exception as e:
                    logging.warning(f"Error fetching currently playing data: {e}")
                    playback = {}
                    track_id = None
                    last_audio_analysis = []
                    progress_ms = 0

                # Build the queue_info dictionary with error handling for missing data
                queue_info = {
                    'queue': [
                        {
                            'name': track.get('name', 'Unknown track'),
                            'artists': [{'name': artist.get('name', 'Unknown artist')} for artist in track.get('artists', [])],
                            'album': {
                                'name': track.get('album', {}).get('name', 'Unknown album'),
                                'images': track.get('album', {}).get('images', [])
                            }
                        } for track in queue
                    ],
                    'currently_playing': {
                        'id': currently_playing.get('id', 'No ID'),
                        'name': currently_playing.get('name', 'No track playing'),
                        'artists': [{'name': artist.get('name', 'Unknown artist')} for artist in currently_playing.get('artists', [])],
                        'album': {
                            'name': currently_playing.get('album', {}).get('name', 'No album info'),
                            'images': currently_playing.get('album', {}).get('images', [])
                        }
                    },
                    'analysis' : last_audio_analysis ,
                    'progress' :  progress_ms ,
                    'is_playing' : is_playing
                }

                last_queue_call = queue_info
                # Emit the data to all connected clients
                socketio.emit('update', queue_info)
        except Exception as e:
            logging.error(f"Error in background task: {e}")
        time.sleep(5)



if __name__ == "__main__":
    # Start the background task in a separate thread
    background_thread = Thread(target=background_data_fetch)
    background_thread.daemon = True
    background_thread.start()
    port = 8888
    socketio.run(app, debug=True, host="0.0.0.0", port=port)

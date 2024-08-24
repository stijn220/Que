from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import spotipy
from spotipy.oauth2 import SpotifyOAuth, SpotifyClientCredentials
import os
from dotenv import load_dotenv
import logging

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'your-secret-key')

# Retrieve credentials from environment variables
CLIENT_ID = os.getenv('CLIENT_ID')
CLIENT_SECRET = os.getenv('CLIENT_SECRET')
REDIRECT_URI = os.getenv('REDIRECT_URI')

SCOPE = 'user-read-playback-state user-library-read user-read-currently-playing user-modify-playback-state'

sp_oauth = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=SCOPE
)

#logging.basicConfig(level=logging.DEBUG)

def get_spotify_client():
    token_info = session.get('token_info')
    if not token_info:
        return None

    access_token = token_info.get('access_token')
    if not access_token:
        return None

    return spotipy.Spotify(auth=access_token)

def refresh_access_token():
    token_info = session.get('token_info')
    if not token_info:
        return None

    refresh_token = token_info.get('refresh_token')
    if not refresh_token:
        return None

    try:
        new_token_info = sp_oauth.refresh_access_token(refresh_token)
        session['token_info'] = new_token_info
        return new_token_info.get('access_token')
    except Exception as e:
        logging.error(f"Failed to refresh access token: {e}")
        return None

def handle_spotify_exception(e, retry_function):
    if e.http_status == 401:  # Unauthorized, likely due to expired token
        logging.info("Access token expired. Disconnecting user...")
        disconnect()
        return jsonify({'error': 'Access token expired. Please re-authenticate.'}), 401
    else:
        logging.error(f"Spotify API exception: {e}")
        return jsonify({'error': str(e)}), e.http_status

@app.route('/')
def index():
    if 'token_info' not in session:
        return redirect(url_for('setup'))
    return render_template('index.html')

@app.route('/setup')
def setup():
    if 'token_info' in session:
        return render_template('setup.html', connected=True)
    return render_template('setup.html', connected=False)

@app.route('/connect')
def connect():
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@app.route('/callback')
def callback():
    token_info = sp_oauth.get_access_token(request.args.get('code'))
    session['token_info'] = token_info
    return redirect(url_for('index'))

@app.route('/disconnect')
def disconnect():
    session.pop('token_info', None)
    return redirect(url_for('setup'))

@app.route('/api/currently-playing')
def currently_playing():
    sp = get_spotify_client()
    if sp is None:
        return jsonify({'error': 'User not authenticated'}), 401

    try:
        current_playback = sp.current_playback()
        if current_playback and current_playback['is_playing']:
            track = current_playback['item']
            track_info = {
                'name': track['name'],
                'artists': [{'name': artist['name']} for artist in track['artists']],
                'album': {
                    'name': track['album']['name'],
                    'images': track['album']['images']
                },
                'progress_ms': current_playback['progress_ms'],
                'is_playing': current_playback['is_playing']
            }
            return jsonify(track_info)
        else:
            return jsonify({'error': 'No track is currently playing'}), 204
    except spotipy.exceptions.SpotifyException as e:
        return handle_spotify_exception(e, lambda: sp.current_playback())

@app.route('/api/queue')
def queue():
    sp = get_spotify_client()
    if sp is None:
        return jsonify({'error': 'User not authenticated'}), 401

    try:
        queue_response = sp.queue()
        if queue_response:
            queue = queue_response.get('queue', [])
            queue_info = [
                {
                    'name': track['name'],
                    'artists': [{'name': artist['name']} for artist in track['artists']],
                    'album': {
                        'name': track['album']['name'],
                        'images': track['album']['images']
                    }
                } for track in queue
            ]
            return jsonify({'queue': queue_info})
        else:
            return jsonify({'error': 'Queue is empty'}), 204
    except spotipy.exceptions.SpotifyException as e:
        return handle_spotify_exception(e, lambda: sp.queue())

@app.route('/search', methods=['GET'])
def search():
    sp = get_spotify_client()
    if sp is None:
        return jsonify({'error': 'User not authenticated'}), 401
    
    query = request.args.get('q', '')
    if query:
        try:
            results = sp.search(q=query, type='track', limit=5)
            tracks = [
                {
                    'name': track['name'],
                    'artist': track['artists'][0]['name'],
                    'id': track['id'],
                    'image': track['album']['images'][0]['url'] if track['album']['images'] else '/static/images/no_cover.png'
                } for track in results['tracks']['items']
            ]
            return jsonify(tracks)
        except spotipy.exceptions.SpotifyException as e:
            return handle_spotify_exception(e, lambda: sp.search(q=query, type='track', limit=5))
    return jsonify([])

@app.route('/api/track/<track_id>')
def get_track_details(track_id):
    sp = get_spotify_client()
    if sp is None:
        return jsonify({'error': 'User not authenticated'}), 401

    try:
        track = sp.track(track_id)
        track_info = {
            'name': track['name'],
            'artists': [{'name': artist['name']} for artist in track['artists']],
            'album': {
                'name': track['album']['name'],
                'images': track['album']['images']
            },
            'duration_ms': track['duration_ms']  # Add duration in milliseconds
        }
        return jsonify(track_info)
    except spotipy.exceptions.SpotifyException as e:
        return handle_spotify_exception(e, lambda: sp.track(track_id))

@app.route('/api/add-to-queue', methods=['POST'])
def add_to_queue():
    sp = get_spotify_client()
    if sp is None:
        return jsonify({'error': 'User not authenticated'}), 401

    track_id = request.json.get('track_id')
    print(f"Received track ID: {track_id}")  # Debug log
    if not track_id:
        return jsonify({'error': 'Track ID is required'}), 400

    try:
        # Construct the track URI
        track_uri = f"spotify:track:{track_id}"
        print(f"Track URI: {track_uri}")  # Debug log
        # Add track to queue
        sp.add_to_queue(track_uri)
        return jsonify({'success': 'Track added to queue!'})
    except spotipy.exceptions.SpotifyException as e:
        return handle_spotify_exception(e, lambda: sp.add_to_queue(track_uri))

    

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8888)

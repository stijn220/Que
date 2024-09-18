# 🎶 Que - Collaborative Music Queue

Let everyone contribute to the Queue! Que is a collaborative music queue web application that allows users to add their favorite songs to a shared queue. Perfect for parties, gatherings, or any event where music needs to be shared and enjoyed by all!

---

## 🚀 Features
- **Everyone Can Add Songs to the Queue:** Users can add their favorite songs to the queue using the Que website.
- **Music Control:** Users cannot control playback through the app. All music control is managed via the Spotify player.
- **Spotify Account:** Users do not need a Spotify account to use Que. Only the person who is playing the music needs a Spotify account.
- **Real-time Updates:** Enjoy real-time updates with Flask-SocketIO as the queue changes.
- **Search for Songs:** Easily search for songs using the Spotify API.
- **Easy-to-Use Interface:** Navigate and interact with a user-friendly interface.
  
---

## 🛠 Setup

To get started, follow these steps:

1. **Clone the repository:**
    ```bash
    git clone <repo-url>
    cd <repo-directory>
    ```

2. **Install the required dependencies:**
    ```bash
    pip install Flask Flask-Session Flask-SocketIO spotipy python-dotenv
    ```

3. **Set up your Spotify application credentials:**
    1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
    2. Create a new application by clicking "Create an App".
    3. Fill in the required details for your application. 
   
       ![Create Spotify App](/static/images/Readme/Spotify_dev.png)
       
    4. Save the **Redirect URI**, **Client ID**, and **Client Secret**.
    5. Create a `.env` file in the project root and add the following:
       ```env
       SPOTIPY_CLIENT_ID=<your-spotify-client-id>
       SPOTIPY_CLIENT_SECRET=<your-spotify-client-secret>
       SPOTIPY_REDIRECT_URI=<your-redirect-url>
       ```

4. **Run the application:**
    ```bash
    flask run
    ```
---

## 📸 Usage

![Dashboard Screenshot](/static/images/Readme/Dashboard.png)

1. **Search for a song:** Type the name of the song in the search bar, and a list of results will be displayed.
2. **Add to queue:** Click on a song from the search results to add it to the shared queue.
3. **View the queue:** See the current queue and the song that is currently playing.
4. **Admin control:** (Coming soon) Admin users will have control over the queue, including the ability to skip or reorder tracks.

---


## 📝 License
This project is licensed under the MIT License.

---

## 🙌 Contributing
Feel free to fork this project, submit pull requests, or suggest new features!

---
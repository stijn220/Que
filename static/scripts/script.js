document.addEventListener('DOMContentLoaded', function() {
    function fetchCurrentlyPlaying() {
        fetch('/api/currently-playing')
            .then(response => response.json())
            .then(data => {
                const trackNameElement = document.getElementById('track-name');
                const trackArtistElement = document.getElementById('track-artist');
                const trackCoverElement = document.getElementById('track-cover');
                
                if (data.error) {
                    trackNameElement.textContent = 'Nothing is playing';
                    trackArtistElement.textContent = '';
                    trackCoverElement.src = '/static/images/no_cover.png';
                } else {
                    trackNameElement.textContent = data.name;
                    trackArtistElement.textContent = data.artists.map(artist => artist.name).join(', ');
                    trackCoverElement.src = data.album.images[0]?.url || '/static/images/no_cover.png';
                }
            })
            .catch(error => console.error('Error fetching currently playing:', error));
    }

    function fetchQueue() {
        fetch('/api/queue')
            .then(response => response.json())
            .then(data => {
                const queueList = document.getElementById('queue-list');
                queueList.innerHTML = ''; // Clear previous queue data

                if (data.error) {
                    queueList.innerHTML = '<p>No queue available</p>';
                } else {
                    data.queue.forEach(track => {
                        const trackElement = document.createElement('div');
                        trackElement.className = 'queue-item' + (track.current ? ' current-track' : '');
                        trackElement.innerHTML = `
                            <div class="track-container">
                                <img src="${track.album.images[0]?.url || '/static/images/no_cover.png'}" alt="Track Cover" class="track-cover" width="75" height="75">
                                <div class="track-details">
                                    <h4>${track.name || 'No track name available'}</h4>
                                    <p>${track.artists.map(artist => artist.name).join(', ') || 'No artist info available'}</p>
                                </div>
                            </div>
                        `;
                        queueList.appendChild(trackElement);
                    });
                }
            })
            .catch(error => console.error('Error fetching queue:', error));
    }

    // Fetch and update data every 10 seconds
    setInterval(() => {
        fetchCurrentlyPlaying();
        fetchQueue();
    }, 10000);

    // Initial fetch
    fetchCurrentlyPlaying();
    fetchQueue();
});

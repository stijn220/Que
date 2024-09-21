document.addEventListener('DOMContentLoaded', function() {
    const queueList = document.getElementById('queue-list');
    let scrollingDown = true; // Track scrolling direction
    const scrollAmount = 1; // Amount to scroll
    const waitTime = 2000; // Time to wait before reversing direction (in milliseconds) 
    const scrollspeed = 75;

    const socket = io();

    // Update the current playing track and queue
    socket.on('update', (data) => {
        updateCurrentlyPlaying(data.currently_playing);
        updateQueue(data.queue);
    });

    socket.on('connect', () => {
        console.log('Connected to server');
        // Request initial data if needed
        fetch('/initial_data')
            .then(response => response.text())
            .then(() => console.log('Initial data request sent'));
    });

    function updateCurrentlyPlaying(track) {
        const trackNameElement = document.getElementById('track-name');
        const trackArtistElement = document.getElementById('track-artist');
        const trackCoverElement = document.getElementById('track-cover');

        if (track) {
            trackNameElement.textContent = track.name || 'No track playing';
            trackArtistElement.textContent = track.artists.map(artist => artist.name).join(', ') || 'No artist info available';
            trackCoverElement.src = track.album.images[0]?.url || '/static/images/no_cover.png';
        } else {
            trackNameElement.textContent = 'Nothing is playing';
            trackArtistElement.textContent = '';
            trackCoverElement.src = '/static/images/no_cover.png';
        }
    }

    function updateQueue(queue) {
        const queueList = document.getElementById('queue-list');
        queueList.innerHTML = ''; // Clear previous queue data

        if (queue.length === 0) {
            queueList.innerHTML = '<p>No queue available</p>';
        } else {
            queue.forEach((track, index) => {
                const trackElement = document.createElement('div');
                trackElement.className = 'queue-item' + (track.current ? ' current-track' : '');
                trackElement.innerHTML = `
                    <div class="current-track-container">
                        <span class="track-number">${index + 1}.</span>
                        <img src="${track.album.images[0]?.url || '/static/images/no_cover.png'}" alt="Track Cover" class="current-track-cover">
                        <div class="current-track-details">
                            <h4>${track.name || 'No track name available'}</h4>
                            <p>${track.artists.map(artist => artist.name).join(', ') || 'No artist info available'}</p>
                        </div>
                    </div>
                `;
                queueList.appendChild(trackElement);
            });
        }
    }

    function autoScroll() {
        if (scrollingDown) {
            queueList.scrollTop += scrollAmount; // Scroll down
    
            // Check if we've reached the bottom
            if (queueList.scrollTop + queueList.clientHeight >= queueList.scrollHeight) {
                setTimeout(() => {
                    scrollingDown = false; // Switch direction after waiting
                }, waitTime);
            }
        } else {
            queueList.scrollTop -= scrollAmount; // Scroll up
    
            // Check if we've reached the top
            if (queueList.scrollTop <= 0) {
                setTimeout(() => {
                    scrollingDown = true; // Switch direction after waiting
                }, waitTime);
            }
        }
    }
    setInterval(autoScroll, 100 - scrollspeed); // Adjust the speed by changing the interval (in milliseconds)

});
document.addEventListener('DOMContentLoaded', function() {
    const addToQueueButton = document.getElementById('add-to-queue-button');
    const trackDetails = document.getElementById('track-details');
    const searchInput = document.getElementById('search-bar');
    const resultsBox = document.querySelector('.results ul');
    const closeTrackInfoButton = document.getElementById('close-track-info');
    const socket = io(); // Initialize Socket.IO connection

    let selectedTrackId = null;
    let isAddingToQueue = false; // Flag to prevent multiple requests

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

    // Update currently playing track information
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

    // Update the queue list
    function updateQueue(queue) {
        const queueList = document.getElementById('queue-list');
        queueList.innerHTML = ''; // Clear previous queue data

        if (queue.length === 0) {
            queueList.innerHTML = '<p>No queue available</p>';
        } else {
            queue.forEach(track => {
                const trackElement = document.createElement('div');
                trackElement.className = 'queue-item' + (track.current ? ' current-track' : '');
                trackElement.innerHTML = `
                    <div class="current-track-container">
                        <img src="${track.album.images[0]?.url || '/static/images/no_cover.png'}" alt="Track Cover" class="current-track-cover" width="75" height="75">
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

    // Fetch and display suggestions on input
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length > 0) {
            try {
                const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
                const results = await response.json();
                showResults(results);
            } catch (error) {
                console.error('Error fetching results:', error);
            }
        } else {
            hideResults();
        }
    });

    // Show search results
    function showResults(results) {
        resultsBox.innerHTML = ''; // Clear previous results

        if (results.length > 0) {
            results.forEach(result => {
                const li = document.createElement('li');
                li.className = 'result-item';

                li.innerHTML = `
                    <img src="${result.image}" alt="${result.name} Cover" class="result-image">
                    <div class="result-info">
                        <h4>${result.name}</h4>
                        <p>${result.artist}</p>
                    </div>
                `;

                li.addEventListener('click', () => {
                    searchInput.value = result.name;
                    selectedTrackId = result.id; // Store selected track ID
                    fetchSongDetails(result.id);
                    hideResults();
                });

                resultsBox.appendChild(li); 
            });
            resultsBox.parentElement.classList.add('show');
        } else {
            hideResults();
        }
    }

    // Hide search results
    function hideResults() {
        resultsBox.parentElement.classList.remove('show');
    }

    // Fetch and display track details
    function fetchSongDetails(trackId) {
        fetch(`/api/track/${trackId}`)
            .then(response => response.json())
            .then(trackInfo => {
                updateTrackInfo(trackInfo);
            })
            .catch(error => console.error('Error fetching track details:', error));
    }

    // Update track details on the page
    function updateTrackInfo(trackInfo) {
        if (trackInfo) {
            trackDetails.innerHTML = `
                <img src="${trackInfo.album.images[0]?.url || '/static/images/no_cover.png'}" alt="Track Cover" class="track-cover">
                <div class="track-info-text">
                    <h3>${trackInfo.name || 'No track name available'}</h3>
                    <p>${trackInfo.artists.map(artist => artist.name).join(', ') || 'No artist info available'}</p>
                    <p>${trackInfo.album.name || 'No album info available'}</p>
                    <p>Duration: ${formatDuration(trackInfo.duration_ms) || '0:00'}</p>
                </div>
            `;
            addToQueueButton.style.display = 'block'; // Show the button when track details are updated
            closeTrackInfoButton.style.display = 'block'; // Show the close button
        } else {
            trackDetails.innerHTML = '<p>Select a track to see details</p>';
            addToQueueButton.style.display = 'none'; // Hide the button when no track info
            closeTrackInfoButton.style.display = 'none'; // Hide the close button
        }
    }

    // Format duration from milliseconds to mm:ss
    function formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // Add event listener to "Add to Queue" button
    addToQueueButton.addEventListener('click', function() {
        if (isAddingToQueue) return; // Do nothing if already adding to queue
        if (selectedTrackId) {
            isAddingToQueue = true; // Set flag to true
            addToQueue(selectedTrackId)
                .finally(() => isAddingToQueue = false); // Reset flag when done
        } else {
            showCustomAlert('No track selected', 'error');
        }
    });

    // Add event listener to "Close" button
    closeTrackInfoButton.addEventListener('click', function() {
        trackDetails.innerHTML = '<p>Select a track to see details</p>';
        addToQueueButton.style.display = 'none'; // Hide the button
        closeTrackInfoButton.style.display = 'none'; // Hide the close button
        selectedTrackId = null; // Clear the selected track ID
    });

    // Function to show a custom alert
    function showCustomAlert(message, type = 'success') {
        const alertBox = document.getElementById('custom-alert');
        const alertMessage = document.getElementById('alert-message');
        alertMessage.textContent = message;

        // Add the appropriate class based on the alert type
        alertBox.className = `custom-alert ${type}`;

        // Show the alert
        alertBox.classList.remove('hidden');
        
        // Automatically hide the alert after 3 seconds with fade-out
        setTimeout(() => {
            alertBox.classList.add('hidden');
        }, 3000); // Time before starting fade-out
    }

    // Close button functionality for the custom alert
    document.getElementById('alert-close').addEventListener('click', () => {
        document.getElementById('custom-alert').classList.add('hidden');
    });

    // Function to add track to the queue
    function addToQueue(trackId) {
        return fetch('/api/add-to-queue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ track_id: trackId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showCustomAlert(data.error, 'error');
            } else {
                showCustomAlert('Track added to queue!');
                trackDetails.innerHTML = '<p>Select a track to see details</p>';
                addToQueueButton.style.display = 'none'; // Hide the button
                closeTrackInfoButton.style.display = 'none'; // Hide the close button
                selectedTrackId = null; // Clear the selected track ID
                searchInput.value = ''; // Clear the search bar
            }
        })
        .catch(error => {
            showCustomAlert('Error adding to queue', 'error');
            console.error('Error adding to queue:', error);
        });
    }
});

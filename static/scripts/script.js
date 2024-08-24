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

    // Fetch and update data every 5 seconds (adjusted for performance)
    setInterval(() => {
        fetchCurrentlyPlaying();
        fetchQueue();
    }, 5000);

    // Initial fetch
    fetchCurrentlyPlaying();
    fetchQueue();


    const searchInput = document.getElementById('search-bar');
    const resultsBox = document.querySelector('.results ul');

    // Fetch and display suggestions on input
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length > 0) {
            try {
                const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
                const results = await response.json(); // Changed from 'suggestions' to 'results'
                showResults(results); // Changed function name from 'showSuggestions' to 'showResults'
            } catch (error) {
                console.error('Error fetching results:', error); // Changed message from 'suggestions' to 'results'
            }
        } else {
            hideResults();
        }
    });

    // Show suggestions
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

    // Hide results
    function hideResults() { // Changed function name from 'hideSuggestions' to 'hideResults'
        resultsBox.parentElement.classList.remove('show'); // Hide the results box
    }
});

/**
 * Home Page Module
 * Handles game selection and navigation to streaming page
 */

// Available games configuration
const GAMES = [
  {
    id: 'com.supercell.clashroyale',
    name: 'Clash Royale',
    description: 'Real-time PvP battles',
    thumbnail: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQMt18VVv2_bw1FRALdGOsPqf027hhFfQVFzQ&s'
  }
];

/**
 * Initialize the home page
 */
async function initHomePage() {
  renderGames();
}

/**
 * Render game cards to the grid
 */
function renderGames() {
  const grid = document.getElementById('game-grid');
  if (!grid) return;

  grid.innerHTML = '';

  for (const game of GAMES) {
    const card = createGameCard(game);
    grid.appendChild(card);
  }
}

/**
 * Create a game card element
 */
function createGameCard(game) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.dataset.gameId = game.id;

  const gameId = game.id;

  card.innerHTML = `
    <div class="thumbnail">
      <img src="${game.thumbnail}" alt="${game.name}" onerror="this.style.display='none'">
      <div class="play-overlay">
        <button class="play-btn" onclick="playGame('${gameId}')">Play</button>
      </div>
    </div>
    <div class="info">
      <div class="name">${game.name}</div>
      <div class="description">${game.description}</div>
    </div>
  `;

  // Also allow clicking the card itself
  card.onclick = function() {
    playGame(gameId);
  };

  return card;
}

/**
 * Start playing a game - requires auth
 */
async function playGame(gameId) {
  console.log('Starting game:', gameId);

  // Check if logged in
  const loggedIn = await requireLogin();
  if (!loggedIn) {
    return; // Login modal shown
  }

  // Navigate to app page with game ID
  window.location.href = `/app?game=${encodeURIComponent(gameId)}`;
}

/**
 * Show loading overlay
 */
function showLoading(message) {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="spinner"></div>
      <p id="loading-message">${message}</p>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.classList.remove('hidden');
    const msgEl = overlay.querySelector('#loading-message');
    if (msgEl) msgEl.textContent = message;
  }
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initHomePage);

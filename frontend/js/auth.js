/**
 * Auth Module
 * Handles Supabase authentication with Google OAuth
 */

let supabaseClient = null;

/**
 * Initialize Supabase client
 */
function initAuth() {
  const url = window.CONFIG?.SUPABASE_URL;
  const key = window.CONFIG?.SUPABASE_ANON_KEY || window.CONFIG?.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !key) {
    console.error('Supabase config missing');
    return;
  }

  supabaseClient = window.supabase.createClient(url, key);

  // Listen for auth state changes
  supabaseClient.auth.onAuthStateChange(function(event, session) {
    console.log('Auth state changed:', event);
    updateAuthUI(session?.user);
  });
}

/**
 * Get current user
 */
window.getCurrentUser = async function() {
  if (!supabaseClient) return null;

  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
};

/**
 * Get current session
 */
window.getSession = async function() {
  if (!supabaseClient) return null;

  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
};

/**
 * Get access token for API calls
 */
window.getAccessToken = async function() {
  const session = await window.getSession();
  return session?.access_token || null;
};

/**
 * Sign in with Google
 */
window.signInWithGoogle = async function() {
  if (!supabaseClient) {
    alert('Auth not initialized');
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    console.error('Sign in error:', error);
    alert('Failed to sign in: ' + error.message);
  }
};

/**
 * Sign out
 */
window.signOut = async function() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
  }
};

/**
 * Check if user is logged in
 */
window.isLoggedIn = async function() {
  const user = await window.getCurrentUser();
  return !!user;
};

/**
 * Update UI based on auth state
 */
function updateAuthUI(user) {
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userName) userName.textContent = user.user_metadata?.name || user.email || 'User';
  } else {
    if (loginBtn) loginBtn.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
  }
}

/**
 * Require login - shows login if not logged in
 * Returns true if logged in, false if login popup shown
 */
window.requireLogin = async function() {
  const loggedIn = await window.isLoggedIn();

  if (!loggedIn) {
    window.showLoginModal();
    return false;
  }

  return true;
};

/**
 * Show login modal
 */
window.showLoginModal = function() {
  let modal = document.getElementById('login-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'login-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Sign In Required</h2>
        <p>Please sign in to play games</p>
        <button class="google-btn" onclick="signInWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        <button class="cancel-btn" onclick="hideLoginModal()">Cancel</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.add('show');
};

/**
 * Hide login modal
 */
window.hideLoginModal = function() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.remove('show');
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initAuth();

  // Check initial auth state
  window.getCurrentUser().then(updateAuthUI);
});

document.addEventListener('DOMContentLoaded', () => {

  /* ========== 1. ROUTING ========== */
  const pages = {
    home: document.getElementById('page-home'),
    about: document.getElementById('page-about'),
    mentorship: document.getElementById('page-mentorship'),
    involved: document.getElementById('page-involved'),
    contact: document.getElementById('page-contact')
  };
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  function showPage(name){
    // Ignore Supabase auth hash like #access_token=...
    if(!name || name.includes('access_token') || name.includes('type=')) return;
    // Strip query params: #involved?foo -> involved
    name = name.split('?')[0].split('&')[0];
    if(!pages[name]) return;

    Object.values(pages).forEach(p => { if(p) p.classList.remove('active'); });
    pages[name].classList.add('active');

    document.querySelectorAll('[data-nav]').forEach(el=>{
      el.classList.toggle('active', el.getAttribute('data-nav') === name);
    });

    if(mobileMenu) mobileMenu.style.display = 'none';
    if(hamburger) hamburger.textContent = '☰';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { history.replaceState(null, '', '#' + name); } catch(e){}
  }

  // Global so it can be called from anywhere
  window.showPage = showPage;

  window.selectRole = function(role){
    const select = document.getElementById('inv-role');
    if(select) select.value = role;
    showPage('involved');
    // Wait for page to show, then scroll to form or gate
    setTimeout(() => {
      const form = document.getElementById('involveForm');
      const gate = document.getElementById('authGate');
      const target = (form && getComputedStyle(form).display !== 'none') ? form : gate;
      if(target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  // ONE listener for ALL buttons/links - works for header, hero, footer, mobile menu, cards
  // Uses delegation so it never breaks if buttons are added later
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nav], [data-role]');
    if(!btn) return;
    e.preventDefault();

    const target = btn.getAttribute('data-nav');
    const role = btn.getAttribute('data-role');

    if(target){
      showPage(target);
    }
    // Card buttons on Involved page only have data-role, no data-nav
    if(role){
      if(target !== 'involved') showPage('involved');
      window.selectRole(role);
    }
  });

  // Hamburger
  if(hamburger && mobileMenu){
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.style.display === 'block';
      mobileMenu.style.display = isOpen ? 'none' : 'block';
      hamburger.textContent = isOpen ? '☰' : '✕';
    });
  }

  // Initial page from URL hash - ignore Supabase auth hash
  const rawHash = location.hash.replace('#','');
  if(rawHash && !rawHash.includes('access_token') && pages[rawHash]){
    showPage(rawHash);
  } else {
    if(!document.querySelector('.page.active') && pages.home){
      pages.home.classList.add('active');
    }
  }

  /* ========== 2. SUPABASE AUTH ========== */
  // PASTE YOURS HERE - from Supabase Dashboard > Settings > API
  const SUPABASE_URL = 'https://rpvdvknrnvhajfmfjnuv.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmR2a25ybnZoYWpmbWZqbnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NTY5NTMsImV4cCI6MjExMDQzMjk1M30.YVwfR7QccJSODI7jKq83y4RGQ5kcXcDLUAkBkjVL8lA';

  let supabaseClient = null;
  try {
    if(window.supabase && SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT')){
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.warn('Supabase keys not set - running in demo mode, nav still works');
    }
  } catch(err){
    console.warn('Supabase init failed, auth disabled but nav still works:', err);
  }

  const authGate = document.getElementById('authGate');
  const involveForm = document.getElementById('involveForm');
  const authLoggedIn = document.getElementById('authLoggedIn');
  const loggedInEmail = document.getElementById('loggedInEmail');
  const authMessage = document.getElementById('authMessage');

  async function checkAuth(){
    if(!authGate || !involveForm) return null;
    if(!supabaseClient){
      // Demo mode: show form so site is still usable without keys
      authGate.style.display = 'none';
      involveForm.style.display = 'block';
      if(authLoggedIn) authLoggedIn.style.display = 'none';
      return null;
    }
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if(user){
        authGate.style.display = 'none';
        involveForm.style.display = 'block';
        if(authLoggedIn) authLoggedIn.style.display = 'flex';
        if(loggedInEmail) loggedInEmail.textContent = user.email;
        const emailField = document.getElementById('inv-email');
        if(emailField) emailField.value = user.email;
        const nameField = document.getElementById('inv-name');
        if(nameField && !nameField.value && user.user_metadata?.full_name){
          nameField.value = user.user_metadata.full_name;
        }
      } else {
        authGate.style.display = 'block';
        involveForm.style.display = 'none';
        if(authLoggedIn) authLoggedIn.style.display = 'none';
      }
      return user;
    } catch(e){
      console.warn('checkAuth failed:', e);
      return null;
    }
  }

  // Magic Link button
  const magicBtn = document.getElementById('magicLinkBtn');
  if(magicBtn){
    magicBtn.addEventListener('click', async () => {
      if(!supabaseClient){
        if(authMessage) authMessage.textContent = 'Auth not configured yet. Add your Supabase keys.';
        return;
      }
      const email = document.getElementById('authEmail')?.value.trim();
      if(!email || !email.includes('@')){
        if(authMessage){ authMessage.textContent = 'Please enter a valid email.'; authMessage.style.color = '#B91C1C'; }
        return;
      }
      if(authMessage){ authMessage.textContent = 'Sending link...'; authMessage.style.color = '#0F2A4D'; }
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname + '#involved' }
      });
      if(authMessage){
        if(error){ authMessage.textContent = 'Error: ' + error.message; authMessage.style.color = '#B91C1C'; }
        else { authMessage.textContent = '✅ Check your email! Click the link to unlock the form.'; authMessage.style.color = '#1A5C2E'; }
      }
    });
  }

  // Google button
  const googleBtn = document.getElementById('googleBtn');
  if(googleBtn && supabaseClient){
    googleBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname + '#involved' }
      });
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn && supabaseClient){
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      checkAuth();
    });
  }

  // When user clicks magic link and returns
  if(supabaseClient){
    supabaseClient.auth.onAuthStateChange((event) => {
      if(event === 'SIGNED_IN'){
        checkAuth();
        showPage('involved');
      }
      if(event === 'SIGNED_OUT') checkAuth();
    });
  }

  checkAuth();

  /* ========== 3. GET INVOLVED FORM ========== */
  if(involveForm){
    involveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if(!supabaseClient){
        document.getElementById('involveSuccess').style.display = 'block';
        e.target.reset();
        return;
      }
      const { data: { user } } = await supabaseClient.auth.getUser();
      if(!user){
        alert('Please verify your email first.');
        checkAuth();
        return;
      }
      const btn = e.target.querySelector('button[type="submit"]');
      const orig = btn.textContent;
      btn.textContent = 'Submitting...';
      btn.disabled = true;

      const { error } = await supabaseClient.from('applications').insert({
        user_id: user.id,
        name: document.getElementById('inv-name').value.trim(),
        email: user.email,
        role: document.getElementById('inv-role').value,
        stage: document.getElementById('inv-stage').value,
        message: document.getElementById('inv-message')?.value.trim() || ''
      });

      btn.textContent = orig;
      btn.disabled = false;

      if(error){
        alert('Could not submit: ' + error.message);
      } else {
        document.getElementById('involveSuccess').style.display = 'block';
        e.target.reset();
        document.getElementById('inv-email').value = user.email;
        setTimeout(() => { document.getElementById('involveSuccess').style.display = 'none'; }, 6000);
      }
    });
  }

  /* ========== 4. CONTACT FORM ========== */
  const contactForm = document.getElementById('contactForm');
  if(contactForm){
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Honeypot: if bot filled hidden field, fake success and stop
      const honeypot = document.getElementById('contact-honeypot');
      if(honeypot && honeypot.value){
        document.getElementById('contactSuccess').style.display = 'block';
        return;
      }

      if(!supabaseClient){
        document.getElementById('contactSuccess').style.display = 'block';
        contactForm.reset();
        return;
      }

      // Get fields, ignoring honeypot
      const textInputs = [...contactForm.querySelectorAll('input[type="text"]')].filter(i => i.id !== 'contact-honeypot');
      const emailInput = contactForm.querySelector('input[type="email"]');
      const selects = contactForm.querySelectorAll('select');
      const messageInput = contactForm.querySelector('textarea');

      const name = textInputs[0]?.value.trim() || '';
      const email = emailInput?.value.trim() || '';
      const message = messageInput?.value.trim() || '';

      const { error } = await supabaseClient.from('contact_messages').insert({
        name,
        email,
        topic: selects[0]?.value || '',
        role: selects[1]?.value || '',
        message
      });

      if(error){
        alert('Could not send: ' + error.message);
      } else {
        document.getElementById('contactSuccess').style.display = 'block';
        contactForm.reset();
        setTimeout(() => { document.getElementById('contactSuccess').style.display = 'none'; }, 6000);
      }
    });
  }

});
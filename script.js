    // Golden Stardust Particle System
    const canvas = document.getElementById('ambientCanvas');
    const ctx = canvas.getContext('2d');
    let width, height;
    const particles = [];
    const PARTICLE_COUNT = 45;

    function resizeCanvas() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
      constructor() { this.reset(true); }
      reset(initial = false) {
        this.x = Math.random() * width;
        this.y = initial ? Math.random() * height : height + 10;
        this.size = Math.random() * 2 + 0.6;
        this.speedY = Math.random() * 0.4 + 0.15;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.6 + 0.2;
        this.pulse = Math.random() * 0.02 + 0.005;
        this.pulseDir = 1;
      }
      update() {
        this.y -= this.speedY;
        this.x += this.speedX;
        this.opacity += this.pulse * this.pulseDir;
        if (this.opacity > 0.85) this.pulseDir = -1;
        if (this.opacity < 0.15) this.pulseDir = 1;
        if (this.y < -10 || this.x < -10 || this.x > width + 10) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(213, 185, 121, ${this.opacity})`;
        ctx.shadowBlur = this.size * 4;
        ctx.shadowColor = 'rgba(213, 185, 121, 0.6)';
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

    function animateParticles() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => { p.update(); p.draw(); });
      requestAnimationFrame(animateParticles);
    }
    requestAnimationFrame(animateParticles);

    // Navigation and envelope interactions
    const cover = document.querySelector('#cover');
    const letterScreen = document.querySelector('#letterScreen');
    const questionScreen = document.querySelector('#questionScreen');
    const envelope = document.querySelector('#envelope');

    function resetScroll() {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }

    document.querySelector('#open').addEventListener('click', () => {
      resetScroll();
      cover.classList.add('hidden');
      letterScreen.classList.add('show');
    });

    function createSparkles(x, y) {
      for (let i = 0; i < 24; i++) {
        const p = new Particle();
        p.x = x; p.y = y;
        p.speedX = (Math.random() - 0.5) * 3.5;
        p.speedY = (Math.random() - 0.5) * 3.5;
        p.size = Math.random() * 3 + 1;
        p.opacity = 0.95;
        particles.push(p);
      }
    }

    document.querySelector('#clickHere').addEventListener('click', (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      createSparkles(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5);
      letterScreen.classList.remove('show');
      questionScreen.classList.add('show');
      questionScreen.setAttribute('aria-hidden', 'false');
      document.querySelector('#questionTitle').focus({ preventScroll: true });
    });

    document.querySelector('#questionBack').addEventListener('click', () => {
      questionScreen.classList.remove('show');
      questionScreen.setAttribute('aria-hidden', 'true');
      letterScreen.classList.add('show');
    });

    const dayPlanForm = document.querySelector('#dayPlanForm');
    const planResult = document.querySelector('#planResult');
    const formStatus = document.querySelector('#formStatus');
    const planSubmit = document.querySelector('#planSubmit');
    dayPlanForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (window.location.protocol === 'file:') {
        formStatus.textContent = 'Please open the card through the app server before continuing.';
        return;
      }
      const answers = new FormData(dayPlanForm);
      const destination = answers.get('destination');
      const treat = answers.get('treat');
      const mood = answers.get('mood');
      planSubmit.disabled = true;
      formStatus.textContent = 'Putting your day together…';

      try {
        const response = await fetch('/api/send-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            destination,
            treat,
            mood
          })
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result || result.success !== true) {
          throw new Error(result?.error || 'Could not complete that. Please try again.');
        }

        document.querySelector('#planSummary').textContent = `Your day: ${destination}, with ${treat}, and a ${mood} kind of vibe. I can’t wait!`;
        formStatus.textContent = '';
        dayPlanForm.hidden = true;
        planResult.hidden = false;
      } catch (error) {
        formStatus.textContent = 'Something went wrong. Please try again.';
      } finally {
        planSubmit.disabled = false;
      }
    });

    document.querySelector('#editPlan').addEventListener('click', () => {
      planResult.hidden = true;
      dayPlanForm.hidden = false;
    });

    document.querySelector('#planDone').addEventListener('click', () => {
      questionScreen.classList.remove('show');
      questionScreen.setAttribute('aria-hidden', 'true');
      letterScreen.classList.add('show');
    });

    function openEnvelope() {
      if (!envelope.classList.contains('opened')) {
        const rect = envelope.getBoundingClientRect();
        createSparkles(rect.left + rect.width * 0.5, rect.top + rect.height * 0.58);
        envelope.classList.add('opened');
      }
    }

    envelope.addEventListener('click', openEnvelope);
    envelope.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openEnvelope();
      }
    });

    document.querySelector('#back').addEventListener('click', () => {
      resetScroll();
      letterScreen.classList.remove('show');
      cover.classList.remove('hidden');
      envelope.classList.remove('opened');
    });

    window.addEventListener('resize', resetScroll);

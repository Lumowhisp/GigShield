/* ═══════════════════════════════════════════
   GIG ECONOMY REPORT — INTERACTIVE SCRIPT
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ── Reading Progress Bar ──
    const progressBar = document.getElementById('readingProgress');
    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = scrollPercent + '%';
    });

    // ── Nav Scroll Effect ──
    const nav = document.getElementById('mainNav');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 50);
    });

    // ── Mobile Nav Toggle ──
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });

    // Close mobile nav on link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
        });
    });

    // ── Active Nav Link on Scroll ──
    const sections = document.querySelectorAll('section[id]');
    const navLinksAll = document.querySelectorAll('.nav-link');

    function updateActiveNav() {
        const scrollY = window.scrollY + 120;
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                navLinksAll.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('data-section') === sectionId) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', updateActiveNav);

    // ── Scroll Animations (Intersection Observer) ──
    const animateElements = document.querySelectorAll('.animate-in');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Stagger animation for sibling elements
                const siblings = entry.target.parentElement.querySelectorAll('.animate-in');
                let delay = 0;
                siblings.forEach((sibling) => {
                    if (sibling === entry.target) return;
                });
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, delay);

                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -60px 0px'
    });

    animateElements.forEach((el, index) => {
        // Add stagger delay
        el.style.transitionDelay = (index % 4) * 0.1 + 's';
        observer.observe(el);
    });

    // ── Hero Counter Animation ──
    const heroStatValues = document.querySelectorAll('.hero-stat-value[data-count]');

    function animateCounter(el) {
        const target = parseFloat(el.getAttribute('data-count'));
        const duration = 2000;
        const start = performance.now();
        const isDecimal = target % 1 !== 0;

        function update(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = ease * target;

            if (isDecimal) {
                el.textContent = current.toFixed(1);
            } else {
                el.textContent = Math.round(current);
            }

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                heroStatValues.forEach(el => animateCounter(el));
                heroObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) heroObserver.observe(heroStats);

    // ── Cost Bar Animation ──
    const costBars = document.querySelectorAll('.cost-bar-fill');
    const costBarObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const width = entry.target.getAttribute('data-width');
                entry.target.style.width = width + '%';
                costBarObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    costBars.forEach(bar => costBarObserver.observe(bar));

    // ── Back to Top Button ──
    const backToTop = document.getElementById('backToTop');
    window.addEventListener('scroll', () => {
        backToTop.classList.toggle('visible', window.scrollY > 600);
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ── Smooth scroll for all anchor links ──
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // ── Table Row Hover Highlight ──
    document.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('mouseenter', function () {
            this.style.transition = 'background 0.2s ease';
        });
    });

    // ── Donut Chart Animation ──
    const donutSegments = document.querySelectorAll('.donut-segment');
    const chartObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                donutSegments.forEach((segment, i) => {
                    segment.style.opacity = '0';
                    setTimeout(() => {
                        segment.style.transition = 'opacity 0.8s ease, stroke-dasharray 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
                        segment.style.opacity = '1';
                    }, i * 300);
                });
                chartObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    const chartContainer = document.getElementById('marketShareChart');
    if (chartContainer) chartObserver.observe(chartContainer);

    // ── Flow Bar Animation ──
    const flowSegments = document.querySelectorAll('.flow-segment');
    const flowObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                flowSegments.forEach((seg, i) => {
                    seg.style.opacity = '0';
                    seg.style.transform = 'scaleX(0)';
                    setTimeout(() => {
                        seg.style.transition = 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                        seg.style.opacity = '1';
                        seg.style.transform = 'scaleX(1)';
                    }, i * 150);
                });
                flowObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    const flowBar = document.querySelector('.restaurant-flow');
    if (flowBar) flowObserver.observe(flowBar);

});

// Function to fetch and inject HTML
async function loadComponent(componentName, targetId) {
    try {
        // Appended cache-buster to prevent developer tools from loading stale cached versions
        const response = await fetch(`./components/${componentName}.html?v=` + new Date().getTime());
        if (!response.ok) {
            throw new Error(`Failed to fetch ${componentName}`);
        }
        const html = await response.text();
        const targetElement = document.getElementById(targetId);
        if(!targetElement) return; // Component not needed on this page
        
        targetElement.innerHTML = html;
        // Setup component specific scripts
        if (componentName === 'header') {
            setupHeaderScroll();
            setupMobileMenu();
            setActiveNav();
        } else if (componentName === 'hero') {
            initCounters();
        } else if (componentName === 'courses') {
            initDynamicCourses();
        } else if (componentName === 'features') {
            initHomeCourses();
            // Wire up the courses next-button after component loads
            setTimeout(() => {
                const coursesGrid = document.getElementById('home-courses-grid');
                const coursesNextBtn = document.getElementById('courses-next-btn');
                if (coursesGrid && coursesNextBtn) {
                    coursesNextBtn.addEventListener('click', () => {
                        coursesGrid.scrollBy({ left: 350, behavior: 'smooth' });
                    });
                }
            }, 600);
            initContactForm();
            initFeaturesCarousel();
        } else if (componentName === 'reviews') {
            initReviews();
        } else if (componentName === 'home-blogs') {
            initHomeBlogs();
        }
        // Always try to initialize scroll animations for any newly injected content
        initScrollAnimations();
        scrollToCurrentHash();
    } catch (error) {
        console.error("Error loading component:", error);
    }
}

/* ---- Utility: strip HTML tags to plain text (for card excerpts) ---- */
function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

/* ============================================
   FEATURES CAROUSEL
   ============================================ */
function initFeaturesCarousel() {
    const track      = document.querySelector('.fc-track');
    const slides     = document.querySelectorAll('.fc-slide');
    const dots       = document.querySelectorAll('.fc-dot');
    const prevBtn    = document.querySelector('.fc-prev');
    const nextBtn    = document.querySelector('.fc-next');
    const container  = document.querySelector('.fc-track-container');

    if (!track || slides.length === 0) return;

    let current   = 0;
    let autoTimer = null;
    const TOTAL   = slides.length;
    const DELAY   = 4000;

    function getVisibleSlides() {
        if (window.innerWidth <= 768) return 1;
        if (window.innerWidth <= 1200) return 2;
        return 3;
    }

    function goTo(index) {
        const visible = getVisibleSlides();
        const maxIndex = Math.max(0, TOTAL - visible);
        
        // Clamp index between 0 and maxIndex
        if (index > maxIndex) {
            current = 0; // loop back to start
        } else if (index < 0) {
            current = maxIndex; // loop back to end
        } else {
            current = index;
        }

        // Calculate offset in pixels based on first slide width + margin
        const slideStyle = window.getComputedStyle(slides[0]);
        const slideWidth = slides[0].offsetWidth + parseFloat(slideStyle.marginRight || 0);
        
        track.style.transform = `translateX(-${current * slideWidth}px)`;
        
        dots.forEach((d, i) => {
            // Highlighting dots up to maxIndex
            if (i <= maxIndex) {
                d.style.display = 'inline-block';
                d.classList.toggle('active', i === current);
                d.setAttribute('aria-selected', i === current);
            } else {
                d.style.display = 'none'; // Hide extra dots
            }
        });
    }

    function startAuto() {
        stopAuto();
        autoTimer = setInterval(() => goTo(current + 1), DELAY);
    }

    function stopAuto() {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }

    // Arrow buttons
    if (prevBtn) prevBtn.addEventListener('click', () => { goTo(current - 1); startAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { goTo(current + 1); startAuto(); });

    // Dot buttons
    dots.forEach(dot => {
        dot.addEventListener('click', () => { goTo(parseInt(dot.dataset.index)); startAuto(); });
    });

    // Pause on hover
    if (container) {
        container.addEventListener('mouseenter', stopAuto);
        container.addEventListener('mouseleave', startAuto);
    }

    // Touch / swipe support
    let touchStartX = 0;
    track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
        const delta = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(delta) > 50) { goTo(delta > 0 ? current + 1 : current - 1); startAuto(); }
    }, { passive: true });

    // Keyboard accessibility
    document.addEventListener('keydown', e => {
        if (!document.querySelector('.fc-slider-outer')) return;
        if (e.key === 'ArrowLeft')  { goTo(current - 1); startAuto(); }
        if (e.key === 'ArrowRight') { goTo(current + 1); startAuto(); }
    });

    // Handle Resize
    window.addEventListener('resize', () => {
        goTo(current); // Re-calculate offset on resize
    });

    // Kick off
    goTo(0);
    startAuto();
}

function initCounters() {
    const counters = document.querySelectorAll('.counter');
    if (counters.length === 0) return;

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.getAttribute('data-target'));
                const suffix = counter.getAttribute('data-suffix') || '';
                const duration = 2000; // 2 seconds animation
                let startTimestamp = null;

                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    
                    // EaseOut easing function for a smooth slow-down at the end
                    const easeProgress = 1 - Math.pow(1 - progress, 4);
                    
                    counter.innerText = Math.floor(easeProgress * target) + suffix;
                    
                    if (progress < 1) {
                        window.requestAnimationFrame(step);
                    } else {
                        counter.innerText = target + suffix;
                    }
                };
                
                window.requestAnimationFrame(step);
                observer.unobserve(counter); // Only animate once
            }
        });
    }, { threshold: 0.1 });

    counters.forEach(counter => {
        observer.observe(counter);
    });
}

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target); // Run once
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    document.querySelectorAll('.fade-up').forEach(el => {
        observer.observe(el);
    });
}

function setupHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;
    
    let lastScrollY = window.scrollY;
    let scrollAccumulator = 0;
    const threshold = 18; // require 18px scroll delta to trigger hide/show
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 20) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        const delta = currentScrollY - lastScrollY;
        
        // Hide/Show logic with a smooth delay buffer
        if (currentScrollY > 100) {
            if (delta > 0) {
                // Scrolling down
                scrollAccumulator = Math.max(0, scrollAccumulator + delta);
                if (scrollAccumulator > threshold) {
                    header.classList.add('header-hidden');
                    scrollAccumulator = 0;
                }
            } else if (delta < 0) {
                // Scrolling up
                scrollAccumulator = Math.min(0, scrollAccumulator + delta);
                if (scrollAccumulator < -threshold) {
                    header.classList.remove('header-hidden');
                    scrollAccumulator = 0;
                }
            }
        } else {
            header.classList.remove('header-hidden');
            scrollAccumulator = 0;
        }
        
        lastScrollY = currentScrollY;
    }, { passive: true });
}

function setupMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const nav = document.querySelector('.nav-links');
    if (btn && nav) {
        btn.addEventListener('click', () => {
            nav.classList.toggle('active');
            btn.classList.toggle('active');
        });
    }
}

function setActiveNav() {
    const currentPath = window.location.pathname;

    // Clear all actives
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
    });

    // Match the nav link whose href appears in the current URL path
    const navLinks = document.querySelectorAll('.nav-links a');
    let matched = false;

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        // Skip anchor-only links like #contact
        if (!href || href.startsWith('#')) return;

        if (href !== '/' && currentPath.includes(href)) {
            link.classList.add('active');
            matched = true;
        }
    });

    // If nothing matched, default to Home
    if (!matched) {
        const homeLink = document.querySelector('.nav-links a[href="/"]');
        if (homeLink) homeLink.classList.add('active');
    }
}

function setupSmoothScrolling() {
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (!anchor) return;
        
        const href = anchor.getAttribute('href');
        const isLocalIndexHash = href && href.startsWith('index.html#') && (
            window.location.pathname.endsWith('/index.html') ||
            window.location.pathname.endsWith('/')
        );
        if (href && ((href.startsWith('#') && href.length > 1) || isLocalIndexHash)) {
            e.preventDefault();
            const targetId = href.includes('#') ? href.split('#')[1] : href.substring(1);
            const targetElement = scrollToSection(targetId);
            
            if (targetElement) {
                // Update active states
                if (anchor.closest('.nav-links')) {
                    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
                    anchor.classList.add('active');
                }
                
                history.replaceState(null, '', `#${targetId}`);
                
                // Close mobile menu if open
                const nav = document.querySelector('.nav-links');
                const btn = document.getElementById('mobile-menu-btn');
                if (nav && nav.classList.contains('active')) {
                    nav.classList.remove('active');
                    if (btn) btn.classList.remove('active');
                }
            }
        }
    });
}

function scrollToSection(targetId, behavior = 'smooth') {
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return null;

    const headerOffset = 100;
    const elementPosition = targetElement.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
        top: offsetPosition,
        behavior
    });

    return targetElement;
}

function scrollToCurrentHash() {
    if (!window.location.hash || window.location.hash.length <= 1) return;
    const targetId = decodeURIComponent(window.location.hash.substring(1));
    requestAnimationFrame(() => scrollToSection(targetId, 'auto'));
}

/* Contact Form Handler */
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name    = document.getElementById('cf-name').value.trim();
        const phone   = document.getElementById('cf-phone').value.trim();
        const email   = document.getElementById('cf-email').value.trim();
        const btn     = document.getElementById('contact-submit');
        const success = document.getElementById('contact-success');

        // Basic validation
        if (!name || !phone || !email) {
            [
                { id: 'cf-name',  val: name },
                { id: 'cf-phone', val: phone },
                { id: 'cf-email', val: email }
            ].forEach(({ id, val }) => {
                const el = document.getElementById(id);
                if (!val) {
                    el.style.borderColor = '#ef4444';
                    el.addEventListener('input', () => el.style.borderColor = '', { once: true });
                }
            });
            return;
        }

        // Animate button
        btn.disabled = true;
        btn.textContent = 'Sending...';

        // Simulate async send (replace with real API / EmailJS / Formspree as needed)
        setTimeout(() => {
            form.reset();
            btn.disabled = false;
            btn.textContent = 'Send Message';
            success.style.display = 'flex';
            setTimeout(() => { success.style.display = 'none'; }, 5000);
        }, 1200);
    });
}

// Load all components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // ---- For testing: reset localStorage if ?reset=1 is in URL ----
    if (window.location.search.includes('reset=1')) {
        localStorage.removeItem('ww_pending_reviews');
        localStorage.removeItem('ww_has_reviewed');
        window.location.href = window.location.pathname;
        return;
    }

    loadComponent('header', 'header-root');
    loadComponent('hero', 'hero-root');
    loadComponent('courses', 'courses-root');      // courses.html full page
    loadComponent('home-courses', 'home-courses-root'); // index.html standalone fallback
    loadComponent('features', 'features-root');
    loadComponent('reviews', 'reviews-root');
    loadComponent('home-blogs', 'home-blogs-root');
    loadComponent('footer', 'footer-root');
    
    // Blog initialization
    if (window.location.pathname.includes('blog.html')) {
        initBlogs();
    }
    if (window.location.pathname.includes('blog-post.html')) {
        initBlogPost();
    }

    // Initialize Navigation Interceptors
    setupSmoothScrolling();
    
    // Initialize Story section card scroll animation
    initStoryCardAnimation();
});

/* Smooth Scroll Parallax Animation for Story section Identity Card (LERP Momentum Physics) */
function initStoryCardAnimation() {
    const card = document.querySelector('.story-identity-card');
    const grid = document.querySelector('.story-grid');
    if (!card || !grid) return;

    let targetY = 0;
    let currentY = 0;
    const ease = 0.085; // buttery smooth friction factor
    let animationFrameId = null;

    // Reset transform transition to prevent fighting with LERP ticks
    card.style.transition = 'none';

    const updatePosition = () => {
        if (window.innerWidth <= 992) {
            card.style.transform = '';
            animationFrameId = null;
            return;
        }

        const gridRect = grid.getBoundingClientRect();
        const gridTop = gridRect.top;
        const gridHeight = gridRect.height;
        const cardHeight = card.offsetHeight;
        
        // Start translating when top of grid is 120px from top of viewport
        const startOffset = 120;
        const scrollDistance = -gridTop + startOffset;
        const maxScroll = gridHeight - cardHeight;
        
        if (scrollDistance > 0 && maxScroll > 0) {
            targetY = Math.min(scrollDistance, maxScroll);
        } else {
            targetY = 0;
        }

        // LERP formula: currentY = currentY + (targetY - currentY) * ease
        const diff = targetY - currentY;
        if (Math.abs(diff) > 0.05) {
            currentY += diff * ease;
            card.style.transform = `translateY(${currentY}px)`;
            animationFrameId = requestAnimationFrame(updatePosition);
        } else {
            currentY = targetY;
            card.style.transform = `translateY(${targetY}px)`;
            animationFrameId = null; // stop animation loop when settled
        }
    };

    const triggerUpdate = () => {
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(updatePosition);
        }
    };

    window.addEventListener('scroll', triggerUpdate, { passive: true });
    window.addEventListener('resize', triggerUpdate);
    triggerUpdate(); // Initial run
}

/* ============================================
   REVIEWS — Public facing
   ============================================ */
async function initReviews() {
    const grid         = document.getElementById('reviews-grid');
    const prevArrow    = document.getElementById('rv-prev');
    const nextArrow    = document.getElementById('rv-next');
    const writeBtn     = document.getElementById('write-review-btn');
    const formPanel    = document.getElementById('review-form-panel');
    const closeBtn     = document.getElementById('review-form-close');
    const form         = document.getElementById('review-form');
    const starPicker   = document.getElementById('star-picker');
    const alreadyMsg   = document.getElementById('review-already-done');
    const successMsg   = document.getElementById('review-success');
    const submitBtn    = document.getElementById('rf-submit');

    if (!grid) return;

    let selectedRating = 0;
    let allReviews     = [];

    // ---- Carousel Navigation ----
    if (grid) {
        const scrollAmount = 374; // 350px card + 24px gap
        
        const updateArrows = () => {
            if (!prevArrow || !nextArrow) return;
            prevArrow.style.opacity = grid.scrollLeft <= 10 ? '0' : '1';
            prevArrow.style.pointerEvents = grid.scrollLeft <= 10 ? 'none' : 'all';
            
            const maxScroll = grid.scrollWidth - grid.clientWidth;
            // If there's nothing to scroll at all, hide next arrow as well
            if (maxScroll <= 0) {
                nextArrow.style.opacity = '0';
                nextArrow.style.pointerEvents = 'none';
            } else {
                nextArrow.style.opacity = grid.scrollLeft >= maxScroll - 10 ? '0' : '1';
                nextArrow.style.pointerEvents = grid.scrollLeft >= maxScroll - 10 ? 'none' : 'all';
            }
        };

        grid.addEventListener('scroll', updateArrows, { passive: true });
        window.addEventListener('resize', updateArrows);
        
        // Expose to outer scope for renderReviews to call
        grid._updateArrows = updateArrows;

        if (prevArrow) {
            prevArrow.addEventListener('click', () => {
                grid.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            });
        }
        if (nextArrow) {
            nextArrow.addEventListener('click', () => {
                grid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            });
        }
    }

    // ---- Star picker ----
    if (starPicker) {
        const stars = starPicker.querySelectorAll('.star-btn');
        stars.forEach(btn => {
            btn.addEventListener('mouseenter', () => highlightStars(parseInt(btn.dataset.val), stars));
            btn.addEventListener('mouseleave', () => highlightStars(selectedRating, stars));
            btn.addEventListener('click', () => {
                selectedRating = parseInt(btn.dataset.val);
                highlightStars(selectedRating, stars);
            });
        });
    }

    function highlightStars(count, stars) {
        stars.forEach(s => {
            const val = parseInt(s.dataset.val);
            s.classList.toggle('active', val <= count);
        });
    }

    // ---- Toggle form ----
    if (writeBtn) writeBtn.addEventListener('click', async () => {
        formPanel.style.display = formPanel.style.display === 'none' ? 'block' : 'none';
        if (formPanel.style.display === 'block') {
            await checkAlreadyReviewed();
        }
    });
    if (closeBtn) closeBtn.addEventListener('click', () => { formPanel.style.display = 'none'; });

    // ---- IP + duplicate check ----
    async function getUserIP() {
        try {
            const r = await fetch('https://api.ipify.org?format=json');
            const d = await r.json();
            return d.ip || 'unknown';
        } catch { return 'unknown'; }
    }

    async function checkAlreadyReviewed() {
        const localFlag = localStorage.getItem('ww_has_reviewed');
        if (localFlag === 'true') {
            if (alreadyMsg) alreadyMsg.style.display = 'flex';
            if (submitBtn)  submitBtn.disabled = true;
            return true;
        }
        // Cross-check with stored IP in reviews array
        const ip = await getUserIP();
        const alreadyInList = allReviews.some(rv => rv.ip === ip);
        const pending = JSON.parse(localStorage.getItem('ww_pending_reviews') || '[]');
        const alreadyPending = pending.some(rv => rv.ip === ip);
        if (alreadyInList || alreadyPending) {
            localStorage.setItem('ww_has_reviewed', 'true');
            if (alreadyMsg) alreadyMsg.style.display = 'flex';
            if (submitBtn)  submitBtn.disabled = true;
            return true;
        }
        return false;
    }

    // ---- Render Reviews ----
    function starHTML(rating) {
        return Array.from({ length: 5 }, (_, i) => {
            const filled = i < rating;
            return `<svg viewBox="0 0 24 24" class="${filled ? '' : 'empty'}" fill="${filled ? '#f59e0b' : 'none'}" stroke="${filled ? '#f59e0b' : '#cbd5e1'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        }).join('');
    }

    function getInitials(name) {
        return name.trim().split(' ').map(w => w[0].toUpperCase()).slice(0, 2).join('');
    }

    function renderReviews(approved, pending) {
        const combined = [
            ...approved,
            ...pending.map(rv => ({ ...rv, _pending: true }))
        ];

        if (combined.length === 0) {
            grid.innerHTML = '<p class="no-reviews-msg">No reviews yet. Be the first to share your experience!</p>';
            return;
        }

        grid.innerHTML = combined.map((rv, i) => `
            <div class="review-card${rv._pending ? ' review-card--pending' : ''}${i === 0 ? ' rv-active' : ''}">
                ${rv._pending ? '<div class="review-pending-badge">Pending Approval</div>' : ''}
                
                <div class="review-header">
                    <div class="review-avatar">${getInitials(rv.name)}</div>
                    <div class="review-meta">
                        <div class="review-meta-name">${rv.name}</div>
                        ${rv.course ? `<div class="review-meta-course">${rv.course}</div>` : ''}
                    </div>
                </div>
                
                <div class="review-stars-row">
                    <div class="review-stars">${starHTML(rv.rating)}</div>
                    <span class="review-date">${rv.date || 'Recently'}</span>
                </div>
                
                <p class="review-text" title="${rv.text}">${rv.text}</p>
            </div>
        `).join('');

        // IntersectionObserver to highlight the most-visible card as rv-active
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
                    grid.querySelectorAll('.review-card').forEach(c => c.classList.remove('rv-active'));
                    entry.target.classList.add('rv-active');
                }
            });
        }, { root: grid, threshold: 0.55 });
        grid.querySelectorAll('.review-card').forEach(card => observer.observe(card));
        
        if (grid._updateArrows) setTimeout(grid._updateArrows, 100);
    }

    // ---- Fetch approved reviews from Cloudinary ----
    try {
        const ts  = Date.now();
        const res = await fetch(`https://res.cloudinary.com/dtdt3aw3s/raw/upload/v${ts}/reviews.json`);
        allReviews = res.ok ? await res.json() : [];
    } catch { allReviews = []; }

    // ---- Merge with any locally-pending reviews ----
    const localPending = JSON.parse(localStorage.getItem('ww_pending_reviews') || '[]');
    renderReviews(allReviews, localPending);

    // ---- Submit review ----
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (await checkAlreadyReviewed()) return;

            const name   = document.getElementById('rf-name').value.trim();
            const course = document.getElementById('rf-course').value.trim();
            const text   = document.getElementById('rf-text').value.trim();

            if (!name || !text || selectedRating === 0) {
                if (!name)  document.getElementById('rf-name').style.borderColor = '#ef4444';
                if (!text)  document.getElementById('rf-text').style.borderColor = '#ef4444';
                if (selectedRating === 0) document.getElementById('star-picker').style.outline = '2px solid #ef4444';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.querySelector('.rf-btn-text').textContent = 'Submitting…';

            const ip = await getUserIP();
            const today = new Date().toISOString().split('T')[0];

            const review = {
                id:     Date.now().toString(),
                name,
                course,
                rating: selectedRating,
                text,
                date:   today,
                ip
            };

            // Save to pending queue in localStorage
            const pending = JSON.parse(localStorage.getItem('ww_pending_reviews') || '[]');
            pending.push(review);
            localStorage.setItem('ww_pending_reviews', JSON.stringify(pending));

            // Mark this device as reviewed
            localStorage.setItem('ww_has_reviewed', 'true');

            submitBtn.querySelector('.rf-btn-text').textContent = 'Submit Review';
            if (successMsg) successMsg.style.display = 'flex';
            form.reset();
            selectedRating = 0;
            highlightStars(0, starPicker.querySelectorAll('.star-btn'));
            submitBtn.disabled = true;

            // Re-render grid immediately so user sees their review with pending badge
            const updatedPending = JSON.parse(localStorage.getItem('ww_pending_reviews') || '[]');
            renderReviews(allReviews, updatedPending);
            formPanel.style.display = 'none';

            setTimeout(() => { successMsg.style.display = 'none'; }, 6000);
        });
    }
}/* Dynamic Courses Fetching Logic for Courses Page Only */
async function initDynamicCourses() {
    const grid = document.getElementById('dynamic-courses-grid');
    if (!grid) return;
    
    // Using exactly the 6 courses provided by the user
    const coursesPageData = [
      { 
        id: "basic-coding", 
        title: "Basic Medical Coding Training", 
        category: "Beginner Friendly", 
        description: "Beginner Level Medical Coding Course", 
        mode: ["Online", "Offline"], 
        duration: "8-10", 
        topics: [
          "Anatomy",
          "Physiology",
          "Medical Terminology",
          "Pathology",
          "Introduction to ICD-10-CM",
          "Introduction to CPT",
          "Course Completion Certificate",
          "Job Assistance",
          "Resume Preparation Assistance",
          "Viva Interview Training"
        ] 
      },
      { 
        id: "cpc-training", 
        title: "CPC (Certified Professional Coder) Training", 
        category: "Certification Focused", 
        description: "AAPC CPC Certification Preparation", 
        mode: ["Online", "Offline"], 
        duration: "10–12", 
        topics: [
          "Medical Coding Guidelines",
          "ICD-10-CM (In-depth)",
          "CPT (In-depth)",
          "HCPCS Level II",
          "Modifiers",
          "Medical Billing Basics",
          "Compliance & Ethics",
          "Practice Questions & Mock Exams",
          "Chart/Report Reading Skills",
          "Time Management & Exam Strategies",
          "Course Completion Certificate",
          "Job Assistance",
          "Resume Preparation Assistance",
          "Viva Interview Training"
        ] 
      },
      { 
        id: "ed-coding", 
        title: "ED Coding Training", 
        category: "CPC Relevant", 
        description: "Emergency Department Medical Coding", 
        mode: ["Online", "Offline"], 
        duration: "4–6", 
        topics: [
          "Introduction to Emergency Department Coding",
          "ED Documentation Guidelines & Compliance",
          "CPT Coding for Emergency Procedures",
          "ICD-10-CM Diagnosis Coding for ED",
          "Real-Time Case Scenario Practice",
          "E&M Levels for Emergency Visits (99281–99285)",
          "Critical Care Coding (99291, 99292)",
          "Common ED Procedures & Modifiers",
          "HCPCS Level II Codes in ED",
          "Auditing & Compliance in ED Coding"
        ] 
      },
      { 
        id: "em-coding", 
        title: "E&M Coding Training", 
        category: "CPC Core", 
        description: "Evaluation & Management Coding", 
        mode: ["Online", "Offline"], 
        duration: "4–6", 
        topics: [
          "E&M Coding Fundamentals & History",
          "Outpatient Visit Coding (New vs. Established)",
          "2021 E&M Code Revisions & Updates",
          "Medical Decision Making (MDM) Levels",
          "Time-Based Coding Criteria",
          "Chart Analysis & Documentation Review",
          "Office Visit Codes (99202–99215)",
          "Preventive Medicine Services",
          "Consultation Codes & When to Use Them",
          "Modifier Usage in E&M Coding"
        ] 
      },
      { 
        id: "surgery-coding", 
        title: "Surgery Coding Training", 
        category: "CPC Specialist", 
        description: "Surgical Procedure Coding", 
        mode: ["Online", "Offline"], 
        duration: "6–8", 
        topics: [
          "Introduction to CPT Surgical Sections",
          "Reading & Interpreting Operative Reports",
          "Surgical Global Package Concept",
          "Modifiers: 22, 51, 59, 62, 80 & More",
          "Multiple Procedure Coding Rules",
          "Integumentary, Musculoskeletal, Respiratory Systems",
          "Cardiovascular & Digestive System Coding",
          "Laparoscopic vs. Open Procedure Coding",
          "Bundling & Unbundling (CCI Edits)",
          "Hands-on Operative Report Practice"
        ] 
      },
      { 
        id: "ipdrg-coding", 
        title: "IPDRG Coding Training", 
        category: "Advanced Level", 
        description: "Inpatient / DRG Coding", 
        mode: ["Online", "Offline"], 
        duration: "6–8", 
        topics: [
          "Inpatient Coding Guidelines (UHDDS)",
          "Principal Diagnosis vs. Secondary Diagnosis",
          "DRG Grouping Methodology",
          "MS-DRG System & Weight Calculation",
          "ICD-10-PCS Procedure Coding System",
          "CC and MCC Capture Strategies",
          "Present on Admission (POA) Indicators",
          "Case Mix Index (CMI) Concepts",
          "Coding Queries & Clinical Documentation",
          "Real Inpatient Chart Coding Practice"
        ] 
      }
    ];

    // Clear skeletons
    grid.innerHTML = '';
    
    // Render the new courses array
    renderCourses(grid, coursesPageData);
}

/* Home Page — Preview first 3 courses */
async function initHomeCourses() {
    const grid = document.getElementById('home-courses-grid');
    if (!grid) return;

    const fallbackData = [
      { 
        title: "ED Coding Training", 
        category: "Emergency department", 
        description: "Master emergency department medical coding with real documentation examples, CPT coding rules, and challenging case scenarios.", 
        mode: ["Online", "Offline"], 
        duration: "8", 
        topics: [
          "ED Documentation & Guidelines",
          "CPT Coding for Emergency",
          "Real-time Case Scenarios",
          "ICD-10-CM Diagnosis Coding"
        ] 
      },
      { 
        title: "E&M Coding Training", 
        category: "Evaluation & Management", 
        description: "In-depth training on outpatient visit coding, medical decision-making levels, and comprehensive chart analysis skills.", 
        mode: ["Online", "Offline"], 
        duration: "6", 
        topics: [
          "Outpatient Visit Coding",
          "MDM Levels & Guidelines",
          "Chart Analysis Techniques",
          "2021 E&M Code Updates"
        ] 
      },
      { 
        title: "Surgery Coding Training", 
        category: "Surgical Procedure", 
        description: "Learn to accurately code complex surgical procedures using CPT codes, modifiers, and operative report analysis.", 
        mode: ["Online", "Offline"], 
        duration: "10", 
        topics: [
          "Surgical CPT Code Mastery",
          "Modifiers & Global Period",
          "Operative Report Coding",
          "Bundling & Unbundling Rules"
        ] 
      },
      { 
        title: "IPDRG Coding Training", 
        category: "Inpatient / DRG", 
        description: "Specialized inpatient coding training covering DRG grouping methodology, ICD-10-PCS procedure codes, and MS-DRG optimization.", 
        mode: ["Online", "Offline"], 
        duration: "10", 
        topics: [
          "Inpatient Coding Principles",
          "DRG Grouping & MS-DRG",
          "ICD-10-PCS Procedure Codes",
          "CC/MCC Capture Strategies"
        ] 
      }
    ];

    const cloudinaryBase = 'https://res.cloudinary.com/dtdt3aw3s/raw/upload';

    try {
        const response = await fetch(`${cloudinaryBase}/v${new Date().getTime()}/courses.json`);
        let courses = await response.json();

        // Inject the custom ED Coding Training content into the first course card
        if (courses && courses.length > 0) {
            courses[0] = {
                title: "ED Coding Training",
                category: "Emergency department",
                description: "Master emergency department medical coding with real documentation examples, CPT coding rules, and challenging case scenarios.",
                mode: courses[0].mode || ["Online", "Offline"],
                duration: courses[0].duration || "8",
                topics: [
                    "ED Documentation & Guidelines",
                    "CPT Coding for Emergency",
                    "Real-time Case Scenarios",
                    "ICD-10-CM Diagnosis Coding"
                ]
            };
        }

        // Inject the custom E&M Coding Training content into the E&M course card
        if (courses && courses.length > 0) {
            let emIndex = courses.findIndex(c => c.title && c.title.includes("E&M"));
            if (emIndex === -1 && courses.length > 3) {
                emIndex = 3;
            }
            if (emIndex !== -1) {
                courses[emIndex] = {
                    title: "E&M Coding Training",
                    category: "Evaluation & Management",
                    description: "In-depth training on outpatient visit coding, medical decision-making levels, and comprehensive chart analysis skills.",
                    mode: courses[emIndex].mode || ["Online", "Offline"],
                    duration: courses[emIndex].duration || "6",
                    topics: [
                        "Outpatient Visit Coding",
                        "MDM Levels & Guidelines",
                        "Chart Analysis Techniques",
                        "2021 E&M Code Updates"
                    ]
                };
            }
        }

        grid.innerHTML = '';
        
        // If less than 4 courses, append from fallback to ensure 4 cards
        if (courses.length < 4) {
            const missingCount = 4 - courses.length;
            for (let i = 0; i < missingCount; i++) {
                // Find a fallback course that isn't already in the list by title
                const fallbackCourse = fallbackData.find(f => !courses.some(c => c.title === f.title));
                if (fallbackCourse) {
                    courses.push(fallbackCourse);
                } else {
                    // Fallback to just pushing the next available from fallback
                    courses.push(fallbackData[i % fallbackData.length]);
                }
            }
        }
        
        // Move the E&M course card to the 2nd place (index 1)
        const emIndex = courses.findIndex(c => c.title && c.title.includes("E&M"));
        if (emIndex !== -1 && emIndex !== 1) {
            const emCourse = courses.splice(emIndex, 1)[0];
            courses.splice(1, 0, emCourse);
        }

        // Overwrite the 3rd card (index 2) with Surgery Coding Training
        if (courses && courses.length > 2) {
            courses[2] = {
                title: "Surgery Coding Training",
                category: "Surgical Procedure",
                description: "Learn to accurately code complex surgical procedures using CPT codes, modifiers, and operative report analysis.",
                mode: courses[2].mode || ["Online", "Offline"],
                duration: courses[2].duration || "10",
                topics: [
                    "Surgical CPT Code Mastery",
                    "Modifiers & Global Period",
                    "Operative Report Coding",
                    "Bundling & Unbundling Rules"
                ]
            };
        }

        // Overwrite the 4th card (index 3) with IPDRG Coding Training
        if (courses && courses.length > 3) {
            courses[3] = {
                title: "IPDRG Coding Training",
                category: "Inpatient / DRG",
                description: "Specialized inpatient coding training covering DRG grouping methodology, ICD-10-PCS procedure codes, and MS-DRG optimization.",
                mode: courses[3].mode || ["Online", "Offline"],
                duration: courses[3].duration || "10",
                topics: [
                    "Inpatient Coding Principles",
                    "DRG Grouping & MS-DRG",
                    "ICD-10-PCS Procedure Codes",
                    "CC/MCC Capture Strategies"
                ]
            };
        }
        
        // Only show first 4
        renderCourses(grid, courses.slice(0, 4), true);
    } catch (error) {
        grid.innerHTML = '';
        renderCourses(grid, fallbackData.slice(0, 4), true);
    }
}

function renderCourses(grid, coursesArray, isPreview = false) {
    // Store globally for modal access (full courses page only)
    if (!isPreview) window.globalCourses = coursesArray || [];

    if (!coursesArray || coursesArray.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">No courses have been published yet.</p>';
        return;
    }
    
    coursesArray.forEach((c, index) => {
        const card = document.createElement('div');
        card.className = `course-card fade-up ${isPreview ? 'course-card-compact' : ''}`;
        card.style.animationDelay = `${0.1 * (index % 3)}s`;
        
        // Mode parsing
        const modeStr = (c.mode && Array.isArray(c.mode) && c.mode.length > 0) ? c.mode.join(' / ') : 'Flexible';
        
        // Topics parsing
        let topicsList = (c.topics || []).map(t => `<li>${t}</li>`).join('');
        const topicsHtml = topicsList ? `<ul class="course-topics-list">${topicsList}</ul>` : '';

        // Button — preview cards navigate to courses page, full-page cards open modal
        const actionBtn = isPreview
            ? `<a href="courses.html" class="course-action">
                View Program
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
               </a>`
            : `<button class="course-action" onclick="openCourseModal(${index})">
                Explore Program 
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
               </button>`;

        const courseImages = ['./images/course_1.png', './images/course_2.png', './images/course_3.png'];
        const randomImg = courseImages[index % courseImages.length]; // Use index for stability or Math.random()

        card.innerHTML = `
            <div class="course-card-image">
                <img src="${randomImg}" alt="${c.title}">
            </div>
            <div class="course-content">
                <div class="course-header">
                    <span class="course-badge">${c.category || 'Course'}</span>
                </div>
                <h3 class="course-title">${c.title}</h3>
                <p class="course-desc">${c.description}</p>
                ${topicsHtml}
                <div class="course-meta">
                    <div class="meta-item">
                        <span class="meta-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </span>
                        ${c.duration ? c.duration + ' Weeks' : 'Flexible'}
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                        </span>
                        ${modeStr}
                    </div>
                </div>
                ${actionBtn}
            </div>
        `;
        grid.appendChild(card);
    });
    
    // Bind animations to new elements
    if (typeof initScrollAnimations === 'function') {
        initScrollAnimations();
    }
}

/* Modal Logic */
async function openCourseModal(courseIndex) {
    // 1. Fetch modal HTML if not already in DOM
    let modal = document.getElementById('course-modal');
    if (!modal) {
        let res = await fetch('./components/course-modal.html?v=' + new Date().getTime());
        if(res.ok) {
            let html = await res.text();
            document.body.insertAdjacentHTML('beforeend', html);
            modal = document.getElementById('course-modal');
            
            // Setup close listeners
            const closeBtn = modal.querySelector('.modal-close-btn');
            const backdrop = modal.querySelector('.modal-backdrop');
            
            const closeModal = () => {
                modal.classList.add('hidden');
                document.body.style.overflow = ''; // Restore scroll
            };
            
            closeBtn.addEventListener('click', closeModal);
            backdrop.addEventListener('click', closeModal);
        }
    }
    
    // 2. Populate modal with course data
    if (!window.globalCourses || !window.globalCourses[courseIndex]) return;
    const c = window.globalCourses[courseIndex];
    
    const titleEl = document.getElementById('modal-title');
    const catEl = document.getElementById('modal-category');
    const descEl = document.getElementById('modal-desc');
    const topicsEl = document.getElementById('modal-topics');
    const durEl = document.getElementById('modal-duration');
    const modeEl = document.getElementById('modal-mode');
    
    if(titleEl) titleEl.innerText = c.title;
    if(catEl) catEl.innerText = c.category || 'Course';
    if(descEl) descEl.innerText = c.description || 'No description available.';
    if(durEl) durEl.innerText = c.duration ? c.duration + ' Weeks' : 'Flexible';
    
    if(modeEl) {
        modeEl.innerText = (c.mode && Array.isArray(c.mode) && c.mode.length > 0) ? c.mode.join(' / ') : 'Flexible';
    }
    
    if(topicsEl) {
        topicsEl.innerHTML = '';
        if(c.topics && Array.isArray(c.topics)) {
            c.topics.forEach(t => {
                const li = document.createElement('li');
                li.innerText = t;
                topicsEl.appendChild(li);
            });
        }
    }
    
    // 3. Show Modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}


/* ============================================
   BLOGS PUBLIC LOGIC
   ============================================ */

async function fetchBlogs() {
    const cloudinaryBase = 'https://res.cloudinary.com/dtdt3aw3s/raw/upload';
    try {
        const response = await fetch(`${cloudinaryBase}/v${new Date().getTime()}/blogs.json`);
        if (!response.ok) throw new Error('Network response was not ok');
        const blogs = await response.json();
        return Array.isArray(blogs) ? blogs : [];
    } catch (error) {
        console.warn('Could not fetch blogs from Cloudinary:', error);
        return [];
    }
}

async function initBlogs() {
    const heroEl  = document.getElementById('blog-hero-post');
    const grid    = document.getElementById('dynamic-blog-grid');
    const countEl = document.getElementById('blog-posts-count');
    if (!grid) return;

    const blogs = await fetchBlogs();

    // ---- Helper: initials from name ----
    function initials(name) {
        return (name || 'A').trim().split(' ').map(w => w[0].toUpperCase()).slice(0, 2).join('');
    }

    const fallbackImg = 'data:image/svg+xml;charset=UTF-8,%3Csvg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="1200" height="630" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40px" fill="%2364748b"%3ENo Image%3C/text%3E%3C/svg%3E';

    // ---- Empty state ----
    if (blogs.length === 0) {
        if (heroEl) heroEl.style.display = 'none';
        grid.innerHTML = `
            <div class="blog-empty">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                <h3>No Posts Yet</h3>
                <p>Our team is working on great content. Check back soon!</p>
            </div>`;
        return;
    }

    // ---- Hero post (first blog) ----
    const hero = blogs[0];
    if (heroEl) {
        const heroImg = hero.image || fallbackImg;
        heroEl.innerHTML = '';
        heroEl.href  = `blog-post.html?id=${hero.id}`;
        heroEl.style.textDecoration = 'none';
        // make it an anchor
        const heroAnchor = document.createElement('a');
        heroAnchor.href  = `blog-post.html?id=${hero.id}`;
        heroAnchor.className = 'blog-hero-card fade-up';
        heroAnchor.innerHTML = `
            <img src="${heroImg}" alt="${hero.title}" class="blog-hero-img" loading="eager">
            <div class="blog-hero-gradient"></div>
            <div class="blog-hero-body">
                <div class="blog-hero-left">
                    <span class="blog-hero-tag">Featured</span>
                    <h2 class="blog-hero-title">${hero.title}</h2>
                </div>
                <div class="blog-hero-right">
                    <div class="blog-hero-meta-row">
                        <div class="blog-hero-meta-item">
                            <span class="blog-hero-meta-label">Written by</span>
                            <span class="blog-hero-meta-value">
                                <span class="blog-hero-meta-avatar">${initials(hero.author || 'Admin')}</span>
                                ${hero.author || 'Admin'}
                            </span>
                        </div>
                        <div class="blog-hero-meta-item">
                            <span class="blog-hero-meta-label">Published on</span>
                            <span class="blog-hero-meta-value">${hero.date || ''}</span>
                        </div>
                    </div>
                    <div class="blog-hero-tags">
                        <span class="blog-hero-pill">Medical Coding</span>
                        <span class="blog-hero-pill">AAPC</span>
                    </div>
                </div>
            </div>`;
        // Replace skeleton with the actual hero card
        heroEl.replaceWith(heroAnchor);
        setTimeout(() => { if (typeof initScrollAnimations === 'function') initScrollAnimations(); }, 50);
    }

    // ---- Remaining posts grid ----
    const remaining = blogs.slice(1);
    if (countEl) countEl.textContent = `${remaining.length} article${remaining.length !== 1 ? 's' : ''}`;

    grid.innerHTML = '';

    if (remaining.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:40px 0;font-size:0.95rem;">More articles coming soon!</p>`;
        return;
    }

    remaining.forEach((b, index) => {
        const imgUrl = b.image || fallbackImg;
        const card = document.createElement('a');
        card.href = `blog-post.html?id=${b.id}`;
        card.className = 'blog-card fade-up';
        card.style.animationDelay = `${0.08 * (index % 3)}s`;

        card.innerHTML = `
            <div style="overflow:hidden;">
                <img src="${imgUrl}" alt="${b.title}" class="blog-cover" loading="lazy">
            </div>
            <div class="blog-content">
                <span class="blog-category-tag">Medical Coding</span>
                <div class="blog-meta">
                    <span class="blog-meta-author">
                        <span class="blog-meta-avatar">${initials(b.author || 'Admin')}</span>
                        ${b.author || 'Admin'}
                    </span>
                    <span class="blog-meta-dot"></span>
                    <span>${b.date || ''}</span>
                </div>
                <h3 class="blog-title">${b.title}</h3>
                <p class="blog-excerpt">${stripHtml(b.content)}</p>
                <span class="blog-read-more">
                    Read Article
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </span>
            </div>`;

        grid.appendChild(card);
    });

    if (typeof initScrollAnimations === 'function') {
        initScrollAnimations();
    }
}

async function initBlogPost() {
    const articleNode = document.getElementById('blog-post-article');
    const notFoundNode = document.getElementById('blog-not-found');
    if (!articleNode || !notFoundNode) return;

    const urlParams = new URLSearchParams(window.location.search);
    const blogId = urlParams.get('id');

    if (!blogId) {
        articleNode.style.display = 'none';
        notFoundNode.style.display = 'block';
        return;
    }

    const blogs = await fetchBlogs();
    const blog = blogs.find(b => b.id === blogId);

    if (!blog) {
        articleNode.style.display = 'none';
        notFoundNode.style.display = 'block';
        return;
    }

    // Content is stored as HTML from the rich text editor.
    // For legacy posts saved as plain text, wrap in a paragraph.
    const isHtml = /<[a-z][\/\s\S]*>/i.test(blog.content);
    const formattedContent = isHtml
        ? blog.content
        : blog.content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

    const fallbackImg = 'data:image/svg+xml;charset=UTF-8,%3Csvg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="1200" height="630" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40px" fill="%2364748b"%3ENo Image Available%3C/text%3E%3C/svg%3E';
    const imgUrl = blog.image || fallbackImg;

    document.title = `${blog.title} - Wisdom Wings Healthcare`;

    articleNode.innerHTML = `
        <img src="${imgUrl}" alt="${blog.title}" class="article-cover">
        <div class="article-body">
            <h1 class="article-title">${blog.title}</h1>
            <div class="article-meta">
                <span>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -3px; margin-right: 4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Written by ${blog.author || 'Admin'}
                </span>
                <span>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -3px; margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Published on ${blog.date}
                </span>
            </div>
            <div class="article-content">
                ${formattedContent}
            </div>
        </div>
    `;
}

/* ============================================
   HOME BLOGS PREVIEW
   ============================================ */
async function initHomeBlogs() {
    const grid = document.getElementById('home-blogs-grid');
    if (!grid) return;

    try {
        const blogs = await fetchBlogs();
        grid.innerHTML = '';
        renderHomeBlogs(grid, blogs.slice(0, 3));
    } catch (error) {
        console.error('Error loading home blogs:', error);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">Unable to load latest insights.</p>';
    }
}

function renderHomeBlogs(grid, blogsArray) {
    if (!blogsArray || blogsArray.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">New articles coming soon!</p>';
        return;
    }

    const fallbackImg = 'data:image/svg+xml;charset=UTF-8,%3Csvg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="1200" height="630" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40px" fill="%2364748b"%3ENo Image%3C/text%3E%3C/svg%3E';

    blogsArray.forEach((blog, index) => {
        const card = document.createElement('div');
        card.className = 'blog-preview-card fade-up';
        card.style.animationDelay = `${0.1 * (index % 3)}s`;

        const imgUrl = blog.image || fallbackImg;
        const plainExcerpt = stripHtml(blog.content).substring(0, 120) + '...';

        card.innerHTML = `
            <div class="blog-preview-img-wrap">
                <img src="${imgUrl}" alt="${blog.title}" loading="lazy">
            </div>
            <div class="blog-preview-content">
                <div class="blog-preview-meta">
                    <span>${blog.date}</span>
                    <span>•</span>
                    <span>${blog.author || 'Admin'}</span>
                </div>
                <h3 class="blog-preview-title">${blog.title}</h3>
                <p class="blog-preview-excerpt">${plainExcerpt}</p>
                <a href="blog-post.html?id=${blog.id}" class="blog-preview-link">
                    Read Article
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </a>
            </div>
        `;
        grid.appendChild(card);
    });

    if (typeof initScrollAnimations === 'function') {
        initScrollAnimations();
    }
}

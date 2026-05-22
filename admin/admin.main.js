// ---- Safe Timestamp Fetcher (Global Scope) ----
async function getTimestamp() {
    try {
        const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
        if (res.ok) {
            const data = await res.json();
            return data.unixtime;
        }
    } catch (e) {
        console.warn('WorldTimeAPI failed, using local clock', e);
    }
    return Math.floor(Date.now() / 1000);
}

// ---- SHA-1 for Cloudinary signature (Global Scope) ----
async function sha1(source) {
    const bytes = new TextEncoder().encode(source);
    const digest = await crypto.subtle.digest('SHA-1', bytes);
    return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginOverlay  = document.getElementById('login-overlay');
    const loginForm     = document.getElementById('login-form');
    const dashboard     = document.getElementById('dashboard');
    const errorMsg      = document.getElementById('login-error');
    const editorGrid    = document.getElementById('editor-grid');
    const template      = document.getElementById('course-editor-template');
    const saveBtn       = document.getElementById('save-courses-btn');
    const addBtn        = document.getElementById('add-course-btn');
    const logoutBtn     = document.getElementById('logout-btn');

    // Sync UI elements
    const syncStatus    = document.getElementById('sync-status');
    const syncDot       = document.getElementById('sync-indicator');
    const syncLabel     = document.getElementById('sync-label');

    // Stat counters
    const statTotal      = document.getElementById('stat-total');
    const statOnline     = document.getElementById('stat-online');
    const statCategories = document.getElementById('stat-categories');

    // State
    let courses = [];
    let credentials = { cloudName: 'dtdt3aw3s', apiKey: '', apiSecret: '' };

    // ---- Session Restore ----
    if (sessionStorage.getItem('cloud_credentials')) {
        credentials = JSON.parse(sessionStorage.getItem('cloud_credentials'));
        loginOverlay.style.display = 'none';
        dashboard.style.display = 'flex';
        fetchCurrentCourses();
    }

    // ---- Auth ----
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        credentials.apiKey    = document.getElementById('api-key').value.trim();
        credentials.apiSecret = document.getElementById('api-secret').value.trim();

        try {
            await fetchCurrentCourses();
            sessionStorage.setItem('cloud_credentials', JSON.stringify(credentials));
            loginOverlay.style.display = 'none';
            dashboard.style.display = 'flex';
        } catch (err) {
            errorMsg.style.display = 'flex';
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('cloud_credentials');
        window.location.reload();
    });

    // ---- Fetch from Cloudinary ----
    async function fetchCurrentCourses() {
        editorGrid.innerHTML = `<div class="loading-courses"><div class="spinner"></div><p>Loading courses from Cloudinary…</p></div>`;
        try {
            const url = `https://res.cloudinary.com/${credentials.cloudName}/raw/upload/v${Date.now()}/courses.json`;
            const res = await fetch(url);
            if (res.ok) {
                courses = await res.json();
            } else if (res.status === 404) {
                courses = [];
            } else {
                throw new Error('Unable to read Cloudinary');
            }
            renderEditors();
        } catch (err) {
            courses = [];
            renderEditors();
            console.warn('Falling back to empty state:', err);
        }
    }


    // ---- Deploy to Cloudinary ----
    async function deployToCloudinary() {
        // Run validation first
        if (!validateAll()) {
            alert('Please fill in all required fields (Title, Category, Description) before deploying.');
            return;
        }

        setSyncState('saving');
        saveBtn.disabled = true;

        try {
            const newCourses  = parseGridToJSON();
            const jsonString  = JSON.stringify(newCourses);
            const blob        = new Blob([jsonString], { type: 'application/json' });
            const timestamp   = await getTimestamp();
            const strToSign   = `overwrite=true&public_id=courses.json&timestamp=${timestamp}${credentials.apiSecret}`;
            const signature   = await sha1(strToSign);

            const formData = new FormData();
            formData.append('file', blob, 'courses.json');
            formData.append('api_key', credentials.apiKey);
            formData.append('timestamp', timestamp);
            formData.append('public_id', 'courses.json');
            formData.append('signature', signature);
            formData.append('resource_type', 'raw');
            formData.append('overwrite', 'true');

            const res    = await fetch(`https://api.cloudinary.com/v1_1/${credentials.cloudName}/raw/upload`, { method: 'POST', body: formData });
            const result = await res.json();

            if (result.error) throw new Error(result.error.message);

            setSyncState('synced');
            saveBtn.disabled = true;
        } catch (err) {
            console.error(err);
            setSyncState('error');
            saveBtn.disabled = false;
            alert('Upload failed: ' + err.message);
        }
    }

    saveBtn.addEventListener('click', deployToCloudinary);

    // ---- Sync state helper ----
    function setSyncState(state) {
        syncDot.className = 'sync-dot ' + state;
        syncStatus.className = 'status-chip';

        if (state === 'synced') {
            syncLabel.innerText = 'Synced';
            syncStatus.innerHTML = '<span class="chip-dot"></span> Synced with Cloudinary';
            syncStatus.classList.remove('unsaved', 'saving');
        } else if (state === 'unsaved') {
            syncLabel.innerText = 'Unsaved';
            syncStatus.innerHTML = '<span class="chip-dot"></span> Unsaved Changes';
            syncStatus.classList.add('unsaved');
            saveBtn.disabled = false;
        } else if (state === 'saving') {
            syncLabel.innerText = 'Uploading…';
            syncStatus.innerHTML = '<span class="chip-dot"></span> Uploading…';
            syncStatus.classList.add('saving');
        } else if (state === 'error') {
            syncLabel.innerText = 'Error';
            syncStatus.innerHTML = '<span class="chip-dot"></span> Upload Failed';
            syncStatus.classList.add('unsaved');
        }
    }

    // ---- Render ----
    function updateCategoryDatalist() {
        const datalist = document.getElementById('category-list');
        if (!datalist) return;
        const unique = [...new Set(courses.map(c => c.category).filter(Boolean))];
        datalist.innerHTML = '';
        unique.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            datalist.appendChild(opt);
        });
    }

    function updateStats(coursesList) {
        statTotal.innerText = coursesList.length;
        statOnline.innerText = coursesList.filter(c => c.mode && c.mode.includes('Online')).length;
        const cats = new Set(coursesList.map(c => c.category).filter(Boolean));
        statCategories.innerText = cats.size;
    }

    function renderEditors() {
        editorGrid.innerHTML = '';
        courses.forEach(c => addEditorBlock(c));
        updateCategoryDatalist();
        updateStats(courses);
        saveBtn.disabled = true;
        setSyncState('synced');
    }

    function addEditorBlock(data = null) {
        const clone = template.content.cloneNode(true);
        const card  = clone.querySelector('.editor-card');

        // Number label
        const allCards = editorGrid.querySelectorAll('.editor-card');
        card.querySelector('.card-index-label').innerText = `Course #${allCards.length + 1}`;

        if (data) {
            card.querySelector('.input-title').value    = data.title       || '';
            card.querySelector('.input-category').value = data.category    || '';
            card.querySelector('.input-duration').value = data.duration    || '';
            card.querySelector('.input-desc').value     = data.description || '';

            if (data.topics && Array.isArray(data.topics)) {
                card.querySelector('.input-topics').value = data.topics.join(', ');
            }
            if (data.mode && Array.isArray(data.mode)) {
                if (data.mode.includes('Online'))  card.querySelector('.check-online').checked  = true;
                if (data.mode.includes('Offline')) card.querySelector('.check-offline').checked = true;
            }
        }

        // Mark unsaved on any input
        card.querySelectorAll('input, textarea').forEach(el => {
            el.addEventListener('input', () => setSyncState('unsaved'));
        });
        card.querySelectorAll('input[type="checkbox"]').forEach(el => {
            el.addEventListener('change', () => setSyncState('unsaved'));
        });

        // Delete
        card.querySelector('.delete-btn').addEventListener('click', () => {
            card.remove();
            renumberCards();
            updateStats(parseGridToJSON());
            setSyncState('unsaved');
        });

        editorGrid.appendChild(clone);
    }

    function renumberCards() {
        editorGrid.querySelectorAll('.editor-card').forEach((card, i) => {
            const label = card.querySelector('.card-index-label');
            if (label) label.innerText = `Course #${i + 1}`;
        });
    }

    addBtn.addEventListener('click', () => {
        addEditorBlock();
        setSyncState('unsaved');
    });

    // ---- Validation ----
    function validateAll() {
        let valid = true;
        editorGrid.querySelectorAll('.editor-card').forEach(card => {
            const title = card.querySelector('.input-title');
            const cat   = card.querySelector('.input-category');
            const desc  = card.querySelector('.input-desc');

            [title, cat, desc].forEach(el => {
                if (!el.value.trim()) {
                    el.classList.add('field-error');
                    valid = false;
                    // Remove on fix
                    el.addEventListener('input', () => el.classList.remove('field-error'), { once: true });
                }
            });
        });
        return valid;
    }

    // ---- Parse grid to JSON ----
    function parseGridToJSON() {
        const cards   = editorGrid.querySelectorAll('.editor-card');
        const updated = [];
        cards.forEach(card => {
            const modes  = [];
            if (card.querySelector('.check-online').checked)  modes.push('Online');
            if (card.querySelector('.check-offline').checked) modes.push('Offline');

            const topicText = card.querySelector('.input-topics').value;
            const topics    = topicText.split(',').map(t => t.trim()).filter(Boolean);

            updated.push({
                title:       card.querySelector('.input-title').value.trim(),
                category:    card.querySelector('.input-category').value.trim(),
                duration:    card.querySelector('.input-duration').value.trim(),
                mode:        modes,
                description: card.querySelector('.input-desc').value.trim(),
                topics
            });
        });
        return updated;
    }

});

/* ============================================
   TAB SWITCHING
   ============================================ */
function showTab(tab) {
    const coursesPanel  = document.querySelector('.main-content:not(#reviews-panel):not(#blogs-panel)');
    const reviewsPanel  = document.getElementById('reviews-panel');
    const blogsPanel    = document.getElementById('blogs-panel');
    
    const navCourses    = document.getElementById('nav-courses');
    const navReviews    = document.getElementById('nav-reviews');
    const navBlogs      = document.getElementById('nav-blogs');

    // Reset all
    [coursesPanel, reviewsPanel, blogsPanel].forEach(p => { if(p) p.style.display = 'none'; });
    [navCourses, navReviews, navBlogs].forEach(n => { if(n) n.classList.remove('active'); });

    if (tab === 'reviews') {
        if(reviewsPanel) reviewsPanel.style.display = 'block';
        if(navReviews) navReviews.classList.add('active');
        if(typeof window.loadAdminReviews === 'function') window.loadAdminReviews();
    } else if (tab === 'blogs') {
        if(blogsPanel) blogsPanel.style.display = 'block';
        if(navBlogs) navBlogs.classList.add('active');
        if(typeof window.loadAdminBlogs === 'function') window.loadAdminBlogs();
    } else {
        if(coursesPanel) coursesPanel.style.display = 'block';
        if(navCourses) navCourses.classList.add('active');
    }
}

/* ============================================
   REVIEWS ADMIN
   ============================================ */
(function() {
    let publishedReviews = [];
    let reviewsModified  = false;

    const CLOUD_NAME = 'dtdt3aw3s';
    const REVIEWS_PUBLIC_ID = 'reviews.json';

    function getCredentials() {
        const stored = sessionStorage.getItem('cloud_credentials');
        return stored ? JSON.parse(stored) : null;
    }

    function getReviewsUrl() {
        const ts = Date.now();
        // Use vTimestamp in the path to bypass Cloudinary's aggressive CDN cache
        return `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/v${ts}/${REVIEWS_PUBLIC_ID}`;
    }


    async function deployReviews(reviews, creds) {
        const ts        = await getTimestamp();
        // Parameters MUST be sorted alphabetically. resource_type is excluded from signature.
        const paramStr  = `overwrite=true&public_id=${REVIEWS_PUBLIC_ID}&timestamp=${ts}${creds.apiSecret}`;
        const signature = await sha1(paramStr);

        const blob = new Blob([JSON.stringify(reviews, null, 2)], { type: 'application/json' });
        const fd   = new FormData();
        fd.append('file', blob, 'reviews.json');
        fd.append('public_id', REVIEWS_PUBLIC_ID);
        fd.append('api_key', creds.apiKey);
        fd.append('timestamp', ts);
        fd.append('signature', signature);
        fd.append('resource_type', 'raw');
        fd.append('overwrite', 'true');

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`, {
            method: 'POST',
            body: fd
        });
        const result = await res.json();
        if (result.error) throw new Error(result.error.message);
        if (!res.ok) throw new Error('Upload failed with status: ' + res.status);
        return result;
    }

    function starSVG(filled) {
        const fill   = filled ? '#f59e0b' : 'none';
        const stroke = filled ? '#f59e0b' : '#cbd5e1';
        return `<svg viewBox="0 0 24 24" width="14" height="14" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }

    function renderStars(rating) {
        return Array.from({ length: 5 }, (_, i) => starSVG(i < rating)).join('');
    }

    function renderPublishedReviews() {
        const grid = document.getElementById('reviews-editor-grid');
        if (!grid) return;

        if (publishedReviews.length === 0) {
            grid.innerHTML = '<p style="padding:40px;text-align:center;color:#64748b;">No published reviews yet. Add one above.</p>';
            return;
        }

        grid.innerHTML = publishedReviews.map((rv, i) => `
            <div class="review-admin-card">
                <div class="review-admin-meta">
                    <div class="review-admin-name">${rv.name}</div>
                    <div class="review-admin-course">${rv.course || 'General'}</div>
                    <div class="review-admin-stars">${renderStars(rv.rating)}</div>
                    <div class="review-admin-text">${rv.text}</div>
                    <div class="review-admin-date">${rv.date || ''}</div>
                </div>
                <div class="review-admin-actions">
                    <button class="btn-reject" onclick="deletePublishedReview(${i})">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    function renderPendingReviews() {
        const pending = JSON.parse(localStorage.getItem('ww_pending_reviews') || '[]');
        const section = document.getElementById('pending-reviews-section');
        const grid    = document.getElementById('pending-reviews-grid');
        const badge   = document.getElementById('pending-reviews-badge');

        if (!section || !grid) return;

        if (pending.length === 0) {
            section.style.display = 'none';
            if (badge) badge.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        if (badge) { badge.textContent = pending.length; badge.style.display = 'inline-block'; }

        grid.innerHTML = pending.map((rv, i) => `
            <div class="review-admin-card" style="border-color:#fde68a;background:#fffbeb;">
                <div class="review-admin-meta">
                    <div class="review-admin-name">${rv.name}</div>
                    <div class="review-admin-course">${rv.course || 'General'}</div>
                    <div class="review-admin-stars">${renderStars(rv.rating)}</div>
                    <div class="review-admin-text">${rv.text}</div>
                    <div class="review-admin-date">Submitted ${rv.date || ''}</div>
                </div>
                <div class="review-admin-actions">
                    <button class="btn-approve" onclick="approvePendingReview(${i})">Approve</button>
                    <button class="btn-reject"  onclick="rejectPendingReview(${i})">Reject</button>
                </div>
            </div>
        `).join('');
    }

    window.approvePendingReview = async function(i) {
        const pending = JSON.parse(localStorage.getItem('ww_pending_reviews') || '[]');
        const rv = pending.splice(i, 1)[0];
        localStorage.setItem('ww_pending_reviews', JSON.stringify(pending));
        publishedReviews.push(rv);
        renderPendingReviews();
        renderPublishedReviews();

        // Auto-deploy immediately
        const saveBtn = document.getElementById('save-reviews-btn');
        const creds   = getCredentials();
        if (!creds) {
            // Fallback: just enable the manual deploy button
            if (saveBtn) saveBtn.disabled = false;
            return;
        }
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Publishing…'; }
        try {
            await deployReviews(publishedReviews, creds);
            if (saveBtn) { saveBtn.textContent = '✓ Published!'; }
            setTimeout(() => { if (saveBtn) { saveBtn.textContent = 'Deploy Reviews'; saveBtn.disabled = true; } }, 3000);
        } catch(e) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Deploy Reviews'; }
            alert('Auto-publish failed. Click Deploy Reviews manually.\n' + e.message);
        }
    };

    window.rejectPendingReview = function(i) {
        const pending = JSON.parse(localStorage.getItem('ww_pending_reviews') || '[]');
        pending.splice(i, 1);
        localStorage.setItem('ww_pending_reviews', JSON.stringify(pending));
        renderPendingReviews();
    };

    window.deletePublishedReview = function(i) {
        if (!confirm('Delete this review?')) return;
        publishedReviews.splice(i, 1);
        reviewsModified = true;
        document.getElementById('save-reviews-btn').disabled = false;
        renderPublishedReviews();
    };

    window.loadAdminReviews = async function() {
        const grid    = document.getElementById('reviews-editor-grid');
        const warning = document.getElementById('origin-warning');
        const originTxt = document.getElementById('admin-origin-text');

        // Show warning if not on the same origin as the homepage (port 8000)
        if (warning && originTxt) {
            const port = window.location.port;
            if (port && port !== '8000') {
                originTxt.textContent = window.location.host;
                warning.style.display = 'flex';
            } else {
                warning.style.display = 'none';
            }
        }

        if (!grid) return;
        grid.innerHTML = '<div class="loading-courses"><div class="spinner"></div><p>Loading…</p></div>';

        try {
            const res = await fetch(getReviewsUrl());
            publishedReviews = res.ok ? await res.json() : [];
        } catch { publishedReviews = []; }

        renderPublishedReviews();
        renderPendingReviews();
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Check pending badge on load
        const pending = JSON.parse(localStorage.getItem('ww_pending_reviews') || '[]');
        const badge   = document.getElementById('pending-reviews-badge');
        if (badge && pending.length > 0) {
            badge.textContent = pending.length;
            badge.style.display = 'inline-block';
        }

        // Add Review button
        const addBtn = document.getElementById('add-review-btn');
        const addForm = document.getElementById('add-review-form');
        if (addBtn && addForm) {
            addBtn.addEventListener('click', () => {
                addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
                // Set today as default date
                const dateInput = document.getElementById('new-rv-date');
                if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
            });
        }

        const cancelBtn = document.getElementById('cancel-add-review');
        if (cancelBtn) cancelBtn.addEventListener('click', () => { addForm.style.display = 'none'; });

        const confirmBtn = document.getElementById('confirm-add-review');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const name   = document.getElementById('new-rv-name').value.trim();
                const course = document.getElementById('new-rv-course').value.trim();
                const rating = parseInt(document.getElementById('new-rv-rating').value) || 5;
                const text   = document.getElementById('new-rv-text').value.trim();
                const date   = document.getElementById('new-rv-date').value;

                if (!name || !text) { alert('Name and Review Text are required.'); return; }

                publishedReviews.push({ id: Date.now().toString(), name, course, rating, text, date });
                reviewsModified = true;
                document.getElementById('save-reviews-btn').disabled = false;
                renderPublishedReviews();

                // Clear form
                ['new-rv-name','new-rv-course','new-rv-text'].forEach(id => document.getElementById(id).value = '');
                document.getElementById('new-rv-rating').value = 5;
                addForm.style.display = 'none';
            });
        }

        // Deploy Reviews button
        const saveBtn = document.getElementById('save-reviews-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const creds = getCredentials();
                if (!creds) { alert('Please log in first.'); return; }
                saveBtn.disabled = true;
                saveBtn.textContent = 'Deploying…';
                try {
                    await deployReviews(publishedReviews, creds);
                    saveBtn.textContent = '✓ Deployed!';
                    reviewsModified = false;
                    setTimeout(() => { saveBtn.textContent = 'Deploy Reviews'; }, 3000);
                } catch (e) {
                    alert('Deploy failed: ' + e.message);
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Deploy Reviews';
                }
            });
        }
    });
})();


/* ============================================
   BLOGS ADMIN
   ============================================ */
(function() {
    let publishedBlogs = [];
    const CLOUD_NAME = 'dtdt3aw3s';
    const BLOGS_PUBLIC_ID = 'blogs.json';

    function getCredentials() {
        const stored = sessionStorage.getItem('cloud_credentials');
        return stored ? JSON.parse(stored) : null;
    }

    async function sha1(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function uploadImage(file, creds) {
        const ts = Math.floor(Date.now() / 1000);
        const folder = 'wisdom_wings_blog';
        const paramStr = `folder=${folder}&timestamp=${ts}${creds.apiSecret}`;
        const signature = await sha1(paramStr);

        const fd = new FormData();
        fd.append('file', file);
        fd.append('api_key', creds.apiKey);
        fd.append('timestamp', ts);
        fd.append('folder', folder);
        fd.append('signature', signature);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.secure_url;
    }

    async function deployBlogs(blogsArray, creds) {
        const ts = Math.floor(Date.now() / 1000);
        const paramStr = `overwrite=true&public_id=${BLOGS_PUBLIC_ID}&timestamp=${ts}${creds.apiSecret}`;
        const signature = await sha1(paramStr);

        const blob = new Blob([JSON.stringify(blogsArray, null, 2)], { type: 'application/json' });
        const fd = new FormData();
        fd.append('file', blob, 'blogs.json');
        fd.append('public_id', BLOGS_PUBLIC_ID);
        fd.append('api_key', creds.apiKey);
        fd.append('timestamp', ts);
        fd.append('signature', signature);
        fd.append('resource_type', 'raw');
        fd.append('overwrite', 'true');

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.error) throw new Error(result.error.message);
        return result;
    }

    function renderBlogs() {
        const grid = document.getElementById('blogs-editor-grid');
        if (!grid) return;
        if (publishedBlogs.length === 0) {
            grid.innerHTML = '<p style="padding:40px;text-align:center;color:#64748b;">No blogs published yet.</p>';
            return;
        }
        grid.innerHTML = publishedBlogs.map(b => `<div class="review-admin-card" style="display:flex; gap:16px; align-items:flex-start;">
            <img src="${b.image || ''}" style="width:100px; height:70px; object-fit:cover; border-radius:8px; background:#e2e8f0; flex-shrink:0;">
            <div class="review-admin-meta" style="flex:1;">
                <div class="review-admin-name">${b.title}</div>
                <div class="review-admin-course">By ${b.author} | ${b.date}</div>
                <div class="review-admin-text" style="margin-top:8px; -webkit-line-clamp:2; overflow:hidden; display:-webkit-box;-webkit-box-orient:vertical;">${b.content}</div>
            </div>
            <div class="review-admin-actions">
                <button class="btn-approve" onclick="editBlog('${b.id}')">Edit</button>
                <button class="btn-reject" onclick="deleteBlog('${b.id}')">Delete</button>
            </div>
        </div>`).join('');
    }

    window.loadAdminBlogs = async function() {
        const grid = document.getElementById('blogs-editor-grid');
        if (!grid) return;
        grid.innerHTML = '<div class="loading-courses"><div class="spinner"></div><p>Loading…</p></div>';
        try {
            const ts = Date.now();
            const res = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/v${ts}/${BLOGS_PUBLIC_ID}`);
            publishedBlogs = res.ok ? await res.json() : [];
        } catch { publishedBlogs = []; }
        renderBlogs();
    };

    window.deleteBlog = function(id) {
        if (!confirm('Delete this blog post?')) return;
        publishedBlogs = publishedBlogs.filter(b => b.id !== id);
        document.getElementById('save-blogs-btn').disabled = false;
        renderBlogs();
    };

    window.editBlog = function(id) {
        const blog = publishedBlogs.find(b => b.id === id);
        if (!blog) return;
        document.getElementById('blog-form-title').textContent = 'Edit Blog Post';
        document.getElementById('blog-id').value = blog.id;
        document.getElementById('blog-title').value = blog.title;
        document.getElementById('blog-author').value = blog.author || '';
        document.getElementById('blog-date').value = blog.date;
        // Load HTML content into contenteditable editor
        const editor = document.getElementById('blog-content-editor');
        if (editor) editor.innerHTML = blog.content || '';
        document.getElementById('blog-existing-image').value = blog.image || '';
        const preview = document.getElementById('blog-image-preview');
        if (blog.image) { preview.src = blog.image; preview.style.display = 'block'; } else { preview.style.display = 'none'; }
        document.getElementById('add-blog-form').style.display = 'block';
        document.getElementById('blog-title').focus();
        document.getElementById('blogs-editor-grid').style.display = 'none';
        // Reset to write tab
        if (typeof switchRteTab === 'function') switchRteTab('write');
    };

    document.addEventListener('DOMContentLoaded', () => {
        const addBtn = document.getElementById('add-blog-btn');
        const formPanel = document.getElementById('add-blog-form');
        const cancelBtn = document.getElementById('cancel-add-blog');
        const confirmBtn = document.getElementById('confirm-save-blog');
        const saveBtn = document.getElementById('save-blogs-btn');
        const grid = document.getElementById('blogs-editor-grid');
        const imgInput = document.getElementById('blog-image-input');
        const imgPreview = document.getElementById('blog-image-preview');

        if(imgInput) {
            imgInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if(file) {
                    const url = URL.createObjectURL(file);
                    imgPreview.src = url;
                    imgPreview.style.display = 'block';
                }
            });
        }

        if (addBtn && formPanel) {
            addBtn.addEventListener('click', () => {
                document.getElementById('blog-form-title').textContent = 'New Blog Post';
                document.getElementById('blog-id').value = '';
                document.getElementById('blog-existing-image').value = '';
                ['blog-title','blog-author','blog-image-input'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
                // Clear rich editor
                const editor = document.getElementById('blog-content-editor');
                if (editor) editor.innerHTML = '';
                document.getElementById('blog-date').value = new Date().toISOString().split('T')[0];
                imgPreview.style.display = 'none';
                formPanel.style.display = 'block';
                grid.style.display = 'none';
                if (typeof switchRteTab === 'function') switchRteTab('write');
            });
        }

        if (cancelBtn) cancelBtn.addEventListener('click', () => { formPanel.style.display = 'none'; grid.style.display = 'block'; });

        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const creds = getCredentials();
                if (!creds) { alert('Please log in first.'); return; }

                const idStr = document.getElementById('blog-id').value;
                const title = document.getElementById('blog-title').value.trim();
                const author = document.getElementById('blog-author').value.trim();
                const date = document.getElementById('blog-date').value;
                // Read HTML content from the rich editor
                const editor = document.getElementById('blog-content-editor');
                const content = editor ? editor.innerHTML.trim() : '';
                const contentText = editor ? editor.innerText.trim() : '';
                let imageUrl = document.getElementById('blog-existing-image').value;

                if (!title || !contentText || !date) { alert('Title, Date, and Content are required.'); return; }

                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;margin-right:6px;border-width:2px;display:inline-block;"></span> Uploading...';

                try {
                    if (imgInput.files && imgInput.files.length > 0) {
                        const file = imgInput.files[0];
                        // Restrict to 2MB
                        if (file.size > 2 * 1024 * 1024) {
                            alert('Image size exceeds 2MB limit. Please choose a smaller file.');
                            confirmBtn.disabled = false;
                            confirmBtn.innerHTML = `
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg> Save Blog`;
                            return;
                        }
                        imageUrl = await uploadImage(file, creds);
                    }

                    const blog = {
                        id: idStr || Date.now().toString(),
                        title, author: author || 'Wisdom Wings', date, content, image: imageUrl
                    };

                    if (idStr) {
                        const idx = publishedBlogs.findIndex(b => b.id === idStr);
                        if(idx >= 0) publishedBlogs[idx] = blog;
                    } else {
                        publishedBlogs.unshift(blog);
                    }

                    saveBtn.disabled = false;
                    formPanel.style.display = 'none';
                    grid.style.display = 'block';
                    renderBlogs();
                } catch(e) {
                    alert('Error saving blog: ' + e.message);
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg> Save Blog';
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const creds = getCredentials();
                if (!creds) return;
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;margin-right:6px;border-width:2px;display:inline-block;"></span> Deploying...';
                try {
                    await deployBlogs(publishedBlogs, creds);
                    saveBtn.textContent = '✓ Deployed!';
                    setTimeout(() => { saveBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg> Deploy Blogs'; }, 3000);
                } catch (e) {
                    alert('Deploy failed: ' + e.message);
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Deploy Blogs';
                }
            });
        }
    });
})();

/* =============================================
   RTE GLOBAL HELPERS
   ============================================= */

/** Switch between Write and Preview tabs */
function switchRteTab(tab) {
    const editorEl  = document.getElementById('blog-content-editor');
    const previewEl = document.getElementById('rte-preview');
    const toolbar   = document.getElementById('rte-toolbar');
    const tabWrite  = document.getElementById('rte-tab-write');
    const tabPrev   = document.getElementById('rte-tab-preview');
    const previewContent = document.getElementById('rte-preview-content');

    if (tab === 'preview') {
        // Sync editor HTML to preview
        if (editorEl && previewContent) {
            previewContent.innerHTML = editorEl.innerHTML;
        }
        if (editorEl) editorEl.style.display = 'none';
        if (toolbar)  toolbar.style.display  = 'none';
        if (previewEl) previewEl.style.display = 'block';
        if (tabWrite) tabWrite.classList.remove('active');
        if (tabPrev)  tabPrev.classList.add('active');
    } else {
        if (editorEl) editorEl.style.display = '';
        if (toolbar)  toolbar.style.display  = '';
        if (previewEl) previewEl.style.display = 'none';
        if (tabWrite) tabWrite.classList.add('active');
        if (tabPrev)  tabPrev.classList.remove('active');
        if (editorEl) editorEl.focus();
    }
}

/** Apply block-level heading/paragraph format */
function rteFormat(tag) {
    if (!tag) return;
    const editor = document.getElementById('blog-content-editor');
    if (!editor) return;
    editor.focus();
    document.execCommand('formatBlock', false, tag);
}

/** Apply font size (1–7 scale) */
function rteFontSize(size) {
    if (!size) return;
    const editor = document.getElementById('blog-content-editor');
    if (!editor) return;
    editor.focus();
    document.execCommand('fontSize', false, size);
}

/** Prompt for URL and insert a hyperlink */
function rteInsertLink() {
    const editor = document.getElementById('blog-content-editor');
    if (!editor) return;
    const url = prompt('Enter URL:', 'https://');
    if (url && url !== 'https://') {
        editor.focus();
        document.execCommand('createLink', false, url);
    }
}

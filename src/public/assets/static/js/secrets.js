const profile_url = new URL('../data/portfolio.enc.json', import.meta.url);
const form = document.getElementById('private-links-form');
const form_status = document.getElementById('private-links-status');
const list = document.getElementById('private-links-list');
const heading = document.querySelector('#profile h1');
const cache_prefix = 'private-profile:';

const icons = {
    email: 'fa-envelope', github: 'fa-github', goodreads: 'fa-book',
    mybooks: 'fa-book', linkedin: 'fa-linkedin'
};

const from_base64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));

form_status.textContent = 'Loading private information…';
const encrypted_profile_promise = fetch(profile_url)
    .then(response => {
        if (!response.ok) throw new Error('Unable to load encrypted profile');
        return response.json();
    })
    .then(data => {
        form_status.textContent = 'Enter key to reveal personal information.';
        return { data, cache_key: cache_prefix + data.iv };
    })
    .catch(() => {
        form_status.textContent = "Couldn't load private information. Try again later.";
        return null;
    });

const decrypt_profile = async (password, { salt, iv, ciphertext }) => {
    const material = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: from_base64(salt), iterations: 600000, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: from_base64(iv) }, key, from_base64(ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
};

const render_links = links => {
    list.replaceChildren();
    for (const [label, address] of Object.entries(links ?? {})) {
        const url = new URL(address);
        if (!['https:', 'mailto:'].includes(url.protocol)) continue;

        const icon = document.createElement('i');
        icon.className = `fa ${icons[label.toLowerCase().replace(/[^a-z]/g, '')] ?? 'fa-link'} private-link-icon`;
        icon.setAttribute('aria-hidden', 'true');

        const text = document.createElement('span');
        text.textContent = label;

        const link = document.createElement('a');
        link.className = 'private-link-button';
        link.href = url.href;
        if (url.protocol === 'https:') {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
        link.append(icon, text);
        list.append(link);
    }
    return list.childElementCount;
};

const apply_profile = profile => {
    const name = profile?.full_name?.trim();
    heading.textContent = name;
    document.title = `${name} | Software Developer Portfolio`;
    return render_links(profile.links);
};

const hide_form = () => form.hidden = form_status.hidden = true;

const purge_stale_cache = current_key => {
    for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith(cache_prefix) && key !== current_key) {
            sessionStorage.removeItem(key);
        }
    }
};

const restore_from_cache = async () => {
    const encrypted = await encrypted_profile_promise;
    if (!encrypted) return;

    try {
        purge_stale_cache(encrypted.cache_key);
        const cached = sessionStorage.getItem(encrypted.cache_key);
        if (cached && apply_profile(JSON.parse(cached))) hide_form();
    } catch {
        sessionStorage.removeItem(encrypted.cache_key);
        list.replaceChildren();
    }
};

restore_from_cache();

form.addEventListener('submit', async event => {
    event.preventDefault();
    list.replaceChildren();

    const encrypted = await encrypted_profile_promise;
    if (!encrypted) return;

    form_status.textContent = 'Trying key…';
    try {
        const password = document.getElementById('private-links-key').value;
        const profile = await decrypt_profile(password, encrypted.data);
        const link_count = apply_profile(profile);
        sessionStorage.setItem(encrypted.cache_key, JSON.stringify(profile));

        if (link_count) {
            form.reset();
            hide_form();
        } else {
            form_status.textContent = 'No valid links were found.';
        }
    } catch {
        form_status.textContent = "Couldn't decrypt information. Check the key and try again.";
    }
});
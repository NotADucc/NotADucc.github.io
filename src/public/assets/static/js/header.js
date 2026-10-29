import { is_mobile, DOM_elements, easingFunction } from './shared.js';

export const header_info = {
    HEADER_MIN_HEIGHT: 73,
    is_expanded: false,
    get_header_height: () => header_info.is_expanded ? is_mobile() ? window.innerHeight >> 1 : window.innerHeight : header_info.HEADER_MIN_HEIGHT,
}

const update_header_width = (new_width) => {
    DOM_elements.canvas.width = new_width;
}

const update_header_height = (new_height) => {
    DOM_elements.canvas.height = new_height;
    DOM_elements.header.style.height = DOM_elements.main.style.marginTop = `${new_height}px`;
}

export const animate_header = (index, start, stop, callback_grow, callback_finished) => {
    if (index <= 1) {
        const new_height = start + (stop - start) * easingFunction(index);
        update_header_height(new_height);
        requestAnimationFrame(() => animate_header(index + 0.01, start, stop, callback_grow, callback_finished));

        callback_grow();
    }
    else {
        update_header_height(stop);

        callback_finished();
    }
}

DOM_elements.expand_button.addEventListener("click", (_) => {
    header_info.is_expanded = !header_info.is_expanded;
    DOM_elements.expand_button_triangle.classList.toggle("triangle_rotate");
    if (!is_mobile()) DOM_elements.counter_button_container.classList.toggle("invisible");

    window.dispatchEvent(new CustomEvent("header-expanded", {
        detail: {
            current_height: DOM_elements.canvas.height,
            new_height: header_info.get_header_height()
        }
    }));
});

export const counter_button_container_on_click = (delta, multiplier, lower_bound, upper_bound) => {
    const new_multiplier = multiplier + delta;

    if (new_multiplier < lower_bound || new_multiplier > upper_bound) return;
    
    DOM_elements.minus_button.disabled = new_multiplier <= lower_bound;
    DOM_elements.plus_button.disabled = new_multiplier >= upper_bound;
    
    DOM_elements.plus_button.classList.toggle("disabled", DOM_elements.plus_button.disabled);
    DOM_elements.minus_button.classList.toggle("disabled", DOM_elements.minus_button.disabled);
    
    window.dispatchEvent(new CustomEvent("counter-changed", {
        detail: {
            multiplier: new_multiplier
        }
    }));
}

addEventListener("resize", (_) => {
    const height = header_info.get_header_height();
    if (DOM_elements.canvas.width === window.innerWidth && (is_mobile() || DOM_elements.canvas.innerHeight === height)) 
        return;
    update_header_width(window.innerWidth);
    update_header_height(height);

    window.dispatchEvent(new CustomEvent("header-resized"));
});

addEventListener("load", () =>  window.dispatchEvent(new CustomEvent("events-loaded")));
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

export const register_header_events = () => {
    DOM_elements.expand_button.addEventListener("click", () => {
        header_info.is_expanded = !header_info.is_expanded;
        const expanded = header_info.is_expanded;
        DOM_elements.expand_button_triangle.classList.toggle("triangle_rotate", expanded);

        if (!is_mobile()) {
            DOM_elements.counter_button_container.classList.toggle("invisible", !expanded);
            DOM_elements.dashboard.classList.toggle("collapsed", !expanded);
            DOM_elements.dashboard_content.classList.toggle("invisible", !expanded);
        } else {
            // DOM_elements.counter_button_container.classList.add("invisible");
            // DOM_elements.dashboard.classList.add("collapsed");
            // DOM_elements.dashboard_content.classList.add("invisible");

            DOM_elements.dashboard_mobile_message.classList.toggle("invisible", !expanded);
        }

        window.dispatchEvent(new CustomEvent("header-expanded", {
            detail: {
                current_height: DOM_elements.canvas.height,
                new_height: header_info.get_header_height()
            }
        }));
    });

    addEventListener("resize", () => {
        const height = header_info.get_header_height();

        if (
            DOM_elements.canvas.width === window.innerWidth &&
            DOM_elements.canvas.height === height
        ) return;

        update_header_width(window.innerWidth);
        update_header_height(height);

        window.dispatchEvent(new CustomEvent("header-resized"));
    });
};

export const update_dashboard = (world_info, attraction_matrix) => {
    const multiplier = world_info.multiplier;
    const total = attraction_matrix.reduce(
        (total, group) => total + group.count,
        0
    ) * multiplier;

    DOM_elements.dashboard_content.innerHTML = `
        <div class="dashboard-stats">
            <div class="dashboard-stat">
                <span>Multiplier</span>
                <strong>${multiplier}x</strong>
            </div>
            <div class="dashboard-stat">
                <span>Total Particles</span>
                <strong>${total.toLocaleString()}</strong>
            </div>
        </div>

        <div class="matrix-container">
            <div class="matrix-inputs matrix-labels">
                <span>Attraction Matrix</span>
                ${attraction_matrix.map(group => `
                    <div class="matrix-color" style="background-color: ${group.color}"></div>
                `).join("")}
            </div>

            ${attraction_matrix.map((group, index) => `
                <div class="matrix-group" data-index="${index}">
                    <div class="matrix-inputs">

                        <div class="matrix-group-header">
                            <input
                                type="color"
                                class="matrix-color"
                                value="${group.color}"
                                title="Change particle color"
                            >
                        </div>

                        <div class="number-control">
                            <input
                                type="number"
                                data-field="count"
                                step="1"
                                min="0"
                                value="${group.count}"
                                title="Particle count"
                            >
                            <div class="quantity-nav">
                                <button type="button" class="quantity-button quantity-up" aria-label="Increase count">+</button>
                                <button type="button" class="quantity-button quantity-down" aria-label="Decrease count">−</button>
                            </div>
                        </div>

                        ${group.attraction.map((value, axis) => `
                            <div class="number-control">
                                <input
                                    type="number"
                                    data-field="attraction"
                                    data-axis="${axis}"
                                    step="0.01"
                                    value="${value}"
                                >
                                <div class="quantity-nav">
                                    <button type="button" class="quantity-button quantity-up" aria-label="Increase attraction">+</button>
                                    <button type="button" class="quantity-button quantity-down" aria-label="Decrease attraction">−</button>
                                </div>
                            </div>
                        `).join("")}

                    </div>
                </div>
            `).join("")}
        </div>`;
};

export const setup_dashboard = (world_info, attraction_matrix) => {
    update_dashboard(world_info, attraction_matrix);

    DOM_elements.dashboard.addEventListener("change", (event) => {
        const input = event.target;
        const group_element = input.closest(".matrix-group");

        if (!group_element) return;

        const index = Number(group_element.dataset.index);
        const group = attraction_matrix[index];

        if (!group) return;

        if (input.type === "color") {
            group.color = input.value;
        }
        else {
            const value = Number(input.value);

            if (input.dataset.field === "count") {
                if (!Number.isInteger(value) || value < 0) {
                    update_dashboard(world_info, attraction_matrix);
                    return;
                }

                group.count = value;
            } else if (input.dataset.field === "attraction") {
                const axis = Number(input.dataset.axis);
                group.attraction[axis] = value;
            }
        }

        update_dashboard(world_info, attraction_matrix);
        window.dispatchEvent(new CustomEvent("update-dashboard"));
    });

    DOM_elements.dashboard_content.addEventListener("click", (event) => {
        const button = event.target.closest(".quantity-button");
        if (!button) return;

        const input = button.closest(".number-control").querySelector("input");

        const direction = button.classList.contains("quantity-up") ? 1 : -1;
        const step = Number(input.step) || 1;
        const current = Number(input.value);

        const min = input.min !== "" ? Number(input.min) : -Infinity;
        const max = input.max !== "" ? Number(input.max) : Infinity;

        const precision = (input.step.split(".")[1] || "").length;
        const next = Math.min(max, Math.max(min, current + direction * step));

        input.value = next.toFixed(precision);

        input.dispatchEvent(new Event("change", { bubbles: true }));
    });
};

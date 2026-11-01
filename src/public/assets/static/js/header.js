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

    if (new_multiplier < lower_bound || new_multiplier > upper_bound) 
        return;
    
    DOM_elements.minus_button.disabled = new_multiplier <= lower_bound;
    DOM_elements.plus_button.disabled = new_multiplier >= upper_bound;
    
    DOM_elements.plus_button.classList.toggle("disabled", DOM_elements.plus_button.disabled);
    DOM_elements.minus_button.classList.toggle("disabled", DOM_elements.minus_button.disabled);
    
    window.dispatchEvent(new CustomEvent("counter:changed", {
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

        window.dispatchEvent(new CustomEvent("header:expanded", {
            detail: {
                current_height: DOM_elements.canvas.height,
                new_height: header_info.get_header_height()
            }
        }));
    });

    addEventListener("resize", () => {
        const height = header_info.get_header_height();

        if (DOM_elements.canvas.width === window.innerWidth && DOM_elements.canvas.height === height) 
            return;

        update_header_width(window.innerWidth);
        update_header_height(height);

        window.dispatchEvent(new CustomEvent("header:resized"));
    });
};

export const update_dashboard_stats = (world_info, particle_species_info) => {
    const multiplier = world_info.multiplier;
    const total = particle_species_info.reduce(
        (total, species) => total + species.count,
        0
    ) * multiplier;

    const content = DOM_elements.dashboard_content;

    content.querySelector(".dashboard-particle-multiplier").textContent = `${multiplier}x`;
    content.querySelector(".dashboard-particle-total").textContent = total.toLocaleString();
};

export const setup_dashboard = (world_info, particle_species_info) => {
    const create_dashboard = (world_info, particle_species_info) => {
        const multiplier = world_info.multiplier;
        const total = particle_species_info.reduce((total, species) => total + species.count, 0) * multiplier;

        DOM_elements.dashboard_content.innerHTML = `
            <div class="dashboard-stats">
                <div class="dashboard-stat">
                    <span>Multiplier</span>
                    <strong class="dashboard-particle-multiplier">${multiplier}x</strong>
                </div>
                <div class="dashboard-stat">
                    <span>Total Particles</span>
                    <strong class="dashboard-particle-total">${total.toLocaleString()}</strong>
                </div>
            </div>
            <div class="matrix-container">
                <div class="matrix-inputs matrix-labels">
                    <span>Attraction Matrix</span>
                    ${particle_species_info.map(species => `
                        <div class="matrix-color" style="background-color: ${species.color}"></div>
                    `).join("")}
                </div>

                ${particle_species_info.map((species, index) => `
                    <div class="matrix-group" data-index="${index}">
                        <div class="matrix-inputs">
                            <div class="matrix-group-header">
                                <input
                                    type="color"
                                    class="matrix-color"
                                    value="${species.color}"
                                    title="Change particle color"
                                >
                            </div>
                            <div class="number-control">
                                <input
                                    type="number"
                                    data-field="count"
                                    step="1"
                                    min="0"
                                    value="${species.count}"
                                    title="Particle count"
                                >
                                <div class="quantity-nav">
                                    <button type="button" class="quantity-button quantity-up" aria-label="Increase count">+</button>
                                    <button type="button" class="quantity-button quantity-down" aria-label="Decrease count">-</button>
                                </div>
                            </div>
                            ${species.attraction.map((value, axis) => `
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
                                        <button type="button" class="quantity-button quantity-down" aria-label="Decrease attraction">-</button>
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `).join("")}
            </div>`;
    }

    const update_particle_count = (input, species) => {
        const value = Number(input.value);

        if (!Number.isInteger(value) || value < 0) {
            input.value = species.count;
            return;
        }

        species.count = value;
        update_dashboard_stats(world_info, particle_species_info);
        window.dispatchEvent(new CustomEvent("dashboard:rerender"));
    };

    const update_particle_attraction = (input, species, axis) => {
        const value = Number(input.value);

        if (!Number.isFinite(value)) {
            input.value = species.attraction[axis];
            return;
        }

        species.attraction[axis] = value;
        window.dispatchEvent(new CustomEvent("dashboard:update"));
    };

    const update_particle_color = (input, species) => {
        species.color = input.value;

        window.dispatchEvent(new CustomEvent("dashboard:update"));
    };

    const update_input_step = (input, species, update, direction) => {
        const step = (Number(input.step) || 1) * direction;
        const precision = (input.step.split(".")[1] || "").length;
        input.value = (Number(input.value) + step).toFixed(precision);

        update(input, species);
    }

    const setup_quantity_control = (input, species, update) => {
        const container = input.parentElement;

        input.addEventListener("change", () => update(input, species));
        
        const increase_button = container.querySelector(".quantity-up");
        const decrease_button = container.querySelector(".quantity-down");

        increase_button.addEventListener("click", () => update_input_step(input, species, update, 1));
        decrease_button.addEventListener("click", () => update_input_step(input, species, update, -1));
    };

    const render = () => {
        create_dashboard(world_info, particle_species_info);
        const content = DOM_elements.dashboard_content;

        const matrix_groups = content.querySelectorAll('.matrix-group');
        matrix_groups.forEach((matrix_group, index) => {
            const species = particle_species_info[index];

            const color_input = matrix_group.querySelector('input[type="color"]');
            color_input.addEventListener("change", () => update_particle_color(color_input, species));

            const count_input = matrix_group.querySelector('[data-field="count"]');
            setup_quantity_control(count_input, species, update_particle_count);

            const attraction_inputs = matrix_group.querySelectorAll(`[data-field="attraction"]`);
            attraction_inputs.forEach(attraction_input =>
                setup_quantity_control(
                    attraction_input,
                    species,
                    (input, current_species) => 
                        update_particle_attraction(input, current_species, Number(attraction_input.dataset.axis))
                )
            );
        });
    };

    render();
};

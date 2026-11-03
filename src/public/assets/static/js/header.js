import { is_mobile, DOM_elements, easingFunction } from './shared.js';

export const header_info = {
    HEADER_MIN_HEIGHT: 73,
    is_expanded: false,
    should_matrix_be_visible: true,
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

export const register_header_events = () => {
    const update_dashboard_visibility = () => {
        const expanded = header_info.is_expanded;
        const visible = expanded && header_info.should_matrix_be_visible;

        if (is_mobile()) {
            DOM_elements.dashboard_mobile_message.classList.toggle("invisible", !expanded);
            return;
        }

        DOM_elements.header_actions_container.classList.toggle("invisible", !visible);
        DOM_elements.dashboard.classList.toggle("collapsed", !visible);
        DOM_elements.dashboard_content.classList.toggle("invisible", !visible);
    };

    const update_visibility_icon = () => {
        const visible = header_info.should_matrix_be_visible;

        DOM_elements.visibility_on.classList.toggle("hidden", !visible);
        DOM_elements.visibility_off.classList.toggle("hidden", visible);
    };

    DOM_elements.expand_button.addEventListener("click", () => {
        header_info.is_expanded = !header_info.is_expanded;

        DOM_elements.expand_button_triangle.classList.toggle(
            "triangle_rotate",
            header_info.is_expanded
        );

        update_dashboard_visibility();

        window.dispatchEvent(new CustomEvent("header:expanded", {
            detail: {
                current_height: DOM_elements.canvas.height,
                new_height: header_info.get_header_height()
            }
        }));
    });

    DOM_elements.hide_matrix.addEventListener("click", () => {
        header_info.should_matrix_be_visible = !header_info.should_matrix_be_visible;

        update_visibility_icon();
        update_dashboard_visibility();
    });

    DOM_elements.reset_button.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("particles:reset"));
    });

    DOM_elements.randomize_button.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("particles:randomize"));
    });

    DOM_elements.minus_button.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("particles:species:remove"));
    });

    DOM_elements.plus_button.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("particles:species:add"));
    });

    addEventListener("resize", () => {
        const height = header_info.get_header_height();

        if (DOM_elements.canvas.width === window.innerWidth && DOM_elements.canvas.height === height) 
            return;

        update_header_width(window.innerWidth);
        update_header_height(height);

        window.dispatchEvent(new CustomEvent("header:resized"));
    });

    let idle_timer_id;

    const idle_elements = [
        DOM_elements.dashboard,
        DOM_elements.dashboard_content
    ];

    const reset_idle_timer = () => {
        idle_elements.forEach(el => el.classList.remove('idle'));

        clearTimeout(idle_timer_id);

        idle_timer_id = setTimeout(
            () => idle_elements.forEach(el => el.classList.add('idle')), 
            7000
        ); 
    }

    ['pointermove', 'pointerdown', 'keydown', 'input'].forEach(event => {
        DOM_elements.dashboard.addEventListener(event, reset_idle_timer);
    });
    reset_idle_timer();
};

export const setup_dashboard = (world_info, particle_species_info) => {
    const create_dashboard = (world_info, particle_species_info) => {
        const multiplier = world_info.multiplier;
        const total = particle_species_info.reduce((total, species) => total + species.count, 0) * multiplier;

        DOM_elements.dashboard_content.innerHTML = `
            <div class="dashboard_stats">
                <div class="dashboard_stat">
                    <span>Multiplier</span>
                    <div class="slider_container">
                        <input
                            type="range"
                            id="particle_multiplier_slider"
                            class="slider"
                            min="1"
                            max="100"
                            value="${world_info.multiplier}"
                            step="1"
                        />
                        <strong id="particle_multiplier_value">${multiplier}x</strong>
                    </div>
                </div>
                <div class="dashboard_stat">
                    <span>Total Particles</span>
                    <strong id="particle_total_value">${total.toLocaleString()}</strong>
                </div>
            </div>
            <div class="matrix_container">
                <div class="matrix_inputs matrix_labels">
                    <span>Attraction Matrix</span>
                    ${particle_species_info.map((species, index) => `
                        <div class="matrix_color" style="background-color: ${species.color}" data-y="${index}"></div>
                    `).join("")}
                </div>

                ${particle_species_info.map((species, index) => `
                    <div class="matrix_group" data-x="${index}">
                        <div class="matrix_inputs">
                            <div class="matrix_group_header">
                                <input
                                    type="color"
                                    class="matrix_color"
                                    value="${species.color}"
                                    title="Change particle color"
                                >
                            </div>
                            <div class="number_control">
                                <input
                                    type="number"
                                    data-field="count"
                                    step="1"
                                    min="0"
                                    value="${species.count}"
                                    title="Particle count"
                                >
                                <div class="quantity_nav">
                                    <button type="button" class="quantity_button quantity_up" aria-label="Increase count">+</button>
                                    <button type="button" class="quantity_button quantity_down" aria-label="Decrease count">-</button>
                                </div>
                            </div>
                            ${species.attraction.map((value, index) => `
                                <div class="number_control">
                                    <input
                                        type="number"
                                        data-field="attraction"
                                        data-y="${index}"
                                        step="0.01"
                                        value="${value}"
                                    >
                                    <div class="quantity_nav">
                                        <button type="button" class="quantity_button quantity_up" aria-label="Increase attraction">+</button>
                                        <button type="button" class="quantity_button quantity_down" aria-label="Decrease attraction">-</button>
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `).join("")}
            </div>`;
    }

    const update_dashboard_stats = (world_info, particle_species_info) => {
        const multiplier = world_info.multiplier;
        const total = particle_species_info.reduce(
            (total, species) => total + species.count,
            0
        ) * multiplier;

        const content = DOM_elements.dashboard_content;

        content.querySelector("#particle_multiplier_value").textContent = `${multiplier}x`;
        content.querySelector("#particle_total_value").textContent = total.toLocaleString();
    };

    const update_particle_count = (input, species) => {
        const value = Number(input.value);

        if (!Number.isInteger(value) || value < 0) {
            input.value = species.count;
            return;
        }

        species.count = input.value = value;
        update_dashboard_stats(world_info, particle_species_info);
        input.blur();
        window.dispatchEvent(new CustomEvent("dashboard:rerender"));
    };

    const update_particle_attraction = (input, species, attraction_idx) => {
        const value = Number(input.value);

        if (!Number.isFinite(value)) {
            input.value = species.attraction[attraction_idx];
            return;
        }

        species.attraction[attraction_idx] = input.value = value;
        input.blur();
        window.dispatchEvent(new CustomEvent("dashboard:update"));
    };

    const update_particle_color = (input, species) => {
        species.color = input.value;

        const index = input.closest(".matrix_group").dataset.x;
        const color_indicator = DOM_elements
            .dashboard_content
            .querySelector(`.matrix_labels .matrix_color[data-y="${index}"]`);

        if (color_indicator) 
            color_indicator.style.backgroundColor = input.value;

        input.blur();
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
        
        const increase_button = container.querySelector(".quantity_up");
        const decrease_button = container.querySelector(".quantity_down");

        increase_button.addEventListener("click", () => update_input_step(input, species, update, 1));
        decrease_button.addEventListener("click", () => update_input_step(input, species, update, -1));
    };

    const render = () => {
        document.documentElement.style.setProperty('--column-count', particle_species_info.length);
        create_dashboard(world_info, particle_species_info);
        const content = DOM_elements.dashboard_content;

        const multiplier_slider = content.querySelector("#particle_multiplier_slider");
        multiplier_slider.addEventListener("input", () => {
            world_info.multiplier = Number(multiplier_slider.value);

            update_dashboard_stats(world_info, particle_species_info)
            window.dispatchEvent(new CustomEvent("dashboard:rerender"));
        });

        const matrix_groups = content.querySelectorAll('.matrix_group');
        matrix_groups.forEach((matrix_group, index) => {
            const species = particle_species_info[index];

            const color_input = matrix_group.querySelector('input[type="color"]');
            color_input.addEventListener("change", () => update_particle_color(color_input, species)  );

            const count_input = matrix_group.querySelector('[data-field="count"]');
            setup_quantity_control(count_input, species, update_particle_count);

            const attraction_inputs = matrix_group.querySelectorAll(`[data-field="attraction"]`);
            attraction_inputs.forEach(attraction_input =>
                setup_quantity_control(
                    attraction_input,
                    species,
                    (input, current_species) => 
                        update_particle_attraction(input, current_species, Number(attraction_input.dataset.y))
                )
            );
        });
    };

    render();
};

import { is_mobile, DOM_elements, easing_function } from './shared.js';

const EVENTS = {
    HEADER_EXPANDED: 'header:expanded',
    HEADER_RESIZED: 'header:resized',
    DASHBOARD_UPDATE: 'dashboard:update',
    DASHBOARD_RERENDER: 'dashboard:rerender',
    PARTICLES_RESET: 'particles:reset',
    PARTICLES_RANDOMIZE: 'particles:randomize',
    SPECIES_REMOVE: 'particles:species:remove',
    SPECIES_ADD: 'particles:species:add',
};

const dispatch = (eventName, detail) => {
    const event = detail === undefined
        ? new CustomEvent(eventName)
        : new CustomEvent(eventName, { detail });

    window.dispatchEvent(event);
};

export const header_info = {
    HEADER_MIN_HEIGHT: 73,
    is_expanded: false,
    should_matrix_be_visible: true,

    get_header_height() {
        if (!header_info.is_expanded) return header_info.HEADER_MIN_HEIGHT;
        return is_mobile() ? window.innerHeight >> 1 : window.innerHeight;
    },
};

const update_header_width = (width) => {
    DOM_elements.canvas.width = width;
};

const update_header_height = (height) => {
    DOM_elements.canvas.height = height;
    DOM_elements.header.style.height = DOM_elements.main.style.marginTop = `${height}px`;
};

export const animate_header = (index, start, stop, callback_grow, callback_finished) => {
    if (index > 1) {
        update_header_height(stop);
        callback_finished();
        return;
    }

    const height = start + (stop - start) * easing_function(index);

    update_header_height(height);
    callback_grow();

    requestAnimationFrame(() =>
        animate_header(index + 0.01, start, stop, callback_grow, callback_finished)
    );
};

export const update_species_buttons = ({ can_add, can_remove }) => {
    DOM_elements.plus_button.disabled = !can_add;
    DOM_elements.minus_button.disabled = !can_remove;
};

const update_dashboard_visibility = () => {
    const expanded = header_info.is_expanded;
    const visible = expanded && header_info.should_matrix_be_visible;

    if (is_mobile()) {
        DOM_elements.dashboard_mobile_message.classList.toggle('invisible', !expanded);
        return;
    }

    DOM_elements.header_actions_container.classList.toggle('invisible', !visible);
    DOM_elements.dashboard.classList.toggle('collapsed', !visible);
    DOM_elements.dashboard_content.classList.toggle('invisible', !visible);
};

const update_visibility_icon = () => {
    const visible = header_info.should_matrix_be_visible;

    DOM_elements.visibility_on.classList.toggle('hidden', !visible);
    DOM_elements.visibility_off.classList.toggle('hidden', visible);
};

export const register_header_events = () => {
    DOM_elements.expand_button.addEventListener('click', () => {
        header_info.is_expanded = !header_info.is_expanded;

        DOM_elements.expand_button_triangle.classList.toggle(
            'triangle_rotate',
            header_info.is_expanded
        );

        update_dashboard_visibility();

        dispatch(EVENTS.HEADER_EXPANDED, {
            current_height: DOM_elements.canvas.height,
            new_height: header_info.get_header_height(),
        });
    });

    DOM_elements.hide_matrix.addEventListener('click', () => {
        header_info.should_matrix_be_visible = !header_info.should_matrix_be_visible;

        update_visibility_icon();
        update_dashboard_visibility();
    });

    DOM_elements.reset_button.addEventListener('click', () => {
        dispatch(EVENTS.PARTICLES_RESET);
    });

    DOM_elements.randomize_button.addEventListener('click', () => {
        dispatch(EVENTS.PARTICLES_RANDOMIZE);
    });

    DOM_elements.minus_button.addEventListener('click', () => {
        dispatch(EVENTS.SPECIES_REMOVE);
    });

    DOM_elements.plus_button.addEventListener('click', () => {
        dispatch(EVENTS.SPECIES_ADD);
    });

    window.addEventListener('resize', () => {
        const height = header_info.get_header_height();
        const width = window.innerWidth;

        if (DOM_elements.canvas.width === width && DOM_elements.canvas.height === height) {
            return;
        }

        update_header_width(width);
        update_header_height(height);
        dispatch(EVENTS.HEADER_RESIZED);
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

const WORLD_SETTINGS = [
    {
        id: 'dashboard_stat_particle_size',
        field: 'PARTICLE_SIZE',
        title: 'Particle Size',
        step: 0.1,
        min: 1,
    },
    {
        id: 'dashboard_stat_particle_friction',
        field: 'FRICTION',
        title: 'Friction',
        step: 0.01,
        min: 0.01,
    },
    {
        id: 'dashboard_stat_particle_repulsion',
        field: 'REPULSION',
        title: 'Repulsion',
        step: 0.01,
        min: 0,
    },
    {
        id: 'dashboard_stat_particle_attraction_min_distance',
        field: 'MIN_DISTANCE',
        title: 'Min Radius',
        step: 1,
        min: 0,
    },
    {
        id: 'dashboard_stat_particle_attraction_max_distance',
        field: 'MAX_DISTANCE',
        title: 'Max Radius',
        step: 1,
        min: 0,
    },
];

const create_number_control = ({
    value,
    step,
    field,
    extra_attributes = '',
}) => `
    <div class="number_control">
        <input
            type="number"
            class="dashboard_input"
            data-field="${field}"
            value="${value}"
            step="${step}"
            ${extra_attributes}
        >
        <div class="quantity_nav">
            <button type="button" class="quantity_button quantity_up" aria-label="Increase value">+</button>
            <button type="button" class="quantity_button quantity_down" aria-label="Decrease value">-</button>
        </div>
    </div>
`;

const create_world_setting = (setting, world_info) => `
    <div class="dashboard_stat">
        <span>${setting.title}</span>
        ${create_number_control({
            field: 'count',
            step: setting.step,
            min: setting.min,
            value: world_info[setting.field],
            extra_attributes: [
                `id="${setting.id}"`,
                setting.min != null && `min="${setting.min}"`,
                setting.max != null && `max="${setting.max}"`,
            ].filter(Boolean).join('\n'),
        })}
    </div>
`;

const create_species_row = (species, species_index) => `
    <div class="matrix_group" data-x="${species_index}">
        <div class="matrix_inputs">
            <div class="color_control">
                <input
                    type="color"
                    class="matrix_color dashboard_input"
                    value="${species.color}"
                >
            </div>

            ${create_number_control({
                value: species.count,
                step: 1,
                field: 'count',
                extra_attributes: `min="0"`,
            })}

            ${species.attraction.map((value, attraction_index) =>
                create_number_control({
                    value,
                    step: 0.01,
                    field: 'attraction',
                    extra_attributes: `data-y="${attraction_index}"`,
                })
            ).join('')}
        </div>
    </div>
`;

const create_dashboard = (world_info, particle_species_info) => {
    const total_particles = particle_species_info.reduce(
        (total, species) => total + species.count,
        0
    ) * world_info.multiplier;

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
                    >
                    <strong id="particle_multiplier_value">${world_info.multiplier}x</strong>
                </div>
            </div>

            <div class="dashboard_stat">
                <span>Total Species</span>
                <strong id="species_total_value">${particle_species_info.length.toLocaleString()}</strong>
            </div>
            <div class="dashboard_stat">
                <span>Total Particles</span>
                <strong id="particle_total_value">${total_particles.toLocaleString()}</strong>
            </div>

            ${WORLD_SETTINGS.map(setting =>
                create_world_setting(setting, world_info)
            ).join('')}
        </div>

        <div class="matrix_container">
            <div class="matrix_inputs matrix_labels">
                <span>Attraction Matrix</span>
                ${particle_species_info.map((species, index) => `
                    <div
                        class="matrix_color"
                        style="background-color: ${species.color}"
                        data-y="${index}"
                    ></div>
                `).join('')}
            </div>

            ${particle_species_info.map(create_species_row).join('')}
        </div>
    `;
};

const give_number_within_range = (input) => {
    const min = input.min === '' ? -Infinity : Number(input.min);
    const max = input.max === '' ? Infinity : Number(input.max);
    return Math.min(max, Math.max(min, Number(input.value)));
};

const update_dashboard_stats = (world_info, particle_species_info) => {
    const total_particles = particle_species_info.reduce(
        (total, species) => total + species.count,
        0
    ) * world_info.multiplier;

    const content = DOM_elements.dashboard_content;

    content.querySelector('#particle_multiplier_value').textContent = `${world_info.multiplier}x`;
    content.querySelector('#species_total_value').textContent = particle_species_info.length.toLocaleString();
    content.querySelector('#particle_total_value').textContent = total_particles.toLocaleString();
};

const update_particle_count = (input, species, world_info, all_species) => {
    const value = give_number_within_range(input);

    if (!Number.isInteger(value) || species.count === value) {
        input.value = species.count;
        return;
    }

    input.value = species.count = value;
    update_dashboard_stats(world_info, all_species);

    input.blur();
    dispatch(EVENTS.DASHBOARD_RERENDER);
};

const update_particle_attraction = (input, species, attraction_index) => {
    const value = give_number_within_range(input);

    if (!Number.isFinite(value) || species.attraction[attraction_index] === value) {
        input.value = species.attraction[attraction_index];
        return;
    }

    species.attraction[attraction_index] = input.value = value;

    input.blur();
    dispatch(EVENTS.DASHBOARD_UPDATE);
};

const update_world_setting = (input, world_info, field) => {
    const value = give_number_within_range(input);
    
    if (!Number.isFinite(value) || world_info[field] === value) {
        input.value = world_info[field];
        return;
    }

    input.value = world_info[field] = value
    
    input.blur();
    dispatch(EVENTS.DASHBOARD_UPDATE);
};

const update_particle_color = (input, species) => {
    species.color = input.value;

    const species_index = input.closest('.matrix_group').dataset.x;
    const color_indicator = DOM_elements
        .dashboard_content
        .querySelector(`.matrix_labels .matrix_color[data-y="${species_index}"]`);

    if (color_indicator) {
        color_indicator.style.backgroundColor = input.value;
    }

    input.blur();
    dispatch(EVENTS.DASHBOARD_UPDATE);
};

const update_input_step = (input, data, update, direction) => {
    const step = (Number(input.step) || 1) * direction;
    const precision = (input.step.split('.')[1] || '').length;

    const next_value = Number(input.value) + step
    input.value = next_value.toFixed(precision);

    update(input, data);
};

const setup_quantity_control = (input, data, update) => {
    const container = input.parentElement;

    input.addEventListener('change', () => update(input, data));

    container.querySelector('.quantity_up').addEventListener('click', () => 
        update_input_step(input, data, update, 1)
    );

    container.querySelector('.quantity_down').addEventListener('click', () =>
        update_input_step(input, data, update, -1)
    );
};

const setup_species_controls = (matrix_group, species, world_info, all_species) => {
    const color_input = matrix_group.querySelector('input[type="color"]');
    const count_input = matrix_group.querySelector('[data-field="count"]');
    const attraction_inputs = matrix_group.querySelectorAll('[data-field="attraction"]');

    color_input.addEventListener('change', () => {
        update_particle_color(color_input, species);
    });

    setup_quantity_control(count_input, species, (input, current_species) => {
        update_particle_count(input, current_species, world_info, all_species);
    });

    attraction_inputs.forEach(input => {
        setup_quantity_control(input, species, (current_input, current_species) => {
            update_particle_attraction(
                current_input,
                current_species,
                Number(input.dataset.y)
            );
        });
    });
};

const setup_world_controls = (content, world_info) => {
    WORLD_SETTINGS.forEach(({ id, field }) => {
        const input = content.querySelector(`#${id}`);

        setup_quantity_control(input, world_info, (current_input, current_world) => {
            update_world_setting(current_input, current_world, field);
        });
    });
};

const setup_multiplier_control = (content, world_info, particle_species_info) => {
    const slider = content.querySelector('#particle_multiplier_slider');

    slider.addEventListener('input', () => {
        world_info.multiplier = Number(slider.value);

        update_dashboard_stats(world_info, particle_species_info);
        dispatch(EVENTS.DASHBOARD_RERENDER);
    });
};

export const setup_dashboard = (world_info, particle_species_info) => {
    const render = () => {
        document.documentElement.style.setProperty(
            '--column-count',
            particle_species_info.length
        );

        create_dashboard(world_info, particle_species_info);

        const content = DOM_elements.dashboard_content;

        setup_multiplier_control(content, world_info, particle_species_info);
        setup_world_controls(content, world_info);

        content.querySelectorAll('.matrix_group').forEach((group, index) => {
            setup_species_controls(
                group,
                particle_species_info[index],
                world_info,
                particle_species_info
            );
        });
    };

    render();
};
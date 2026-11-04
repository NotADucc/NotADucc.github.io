import bezier from './helper/bezier.js';

export const DOM_elements = {
    canvas: document.getElementById("noise"),
    header: document.getElementsByTagName("header")[0],
    main: document.getElementsByTagName("main")[0],
    header_actions_container: document.getElementById("header_actions_container"),
    reset_button: document.getElementById("reset_button"),
    randomize_button: document.getElementById("randomize_button"),
    minus_button: document.getElementById("minus_button"),
    plus_button: document.getElementById("plus_button"),
    visibility_on: document.getElementById("visibility_on"),
    visibility_off: document.getElementById("visibility_off"),
    hide_matrix: document.getElementById("hide_matrix"),
    expand_button: document.getElementById("expand_button"),
    expand_button_triangle: document.getElementById("expand_button_triangle"),
    dashboard: document.getElementById("dashboard"),
    dashboard_content: document.getElementById("dashboard_content"),
    dashboard_mobile_message: document.getElementById("mobile_message"),
}

export const is_mobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    random = (min, max, precision) => +(Math.random() * (max - min) + min).toFixed(precision),
    easing_function = bezier(0.45, 0.1, 0.25, 1);
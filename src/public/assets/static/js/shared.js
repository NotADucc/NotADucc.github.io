import bezier from './bezier.js';

export const DOM_elements = {
    canvas: document.getElementById("noise"),
    header: document.getElementsByTagName("header")[0],
    main: document.getElementsByTagName("main")[0],
    expand_button: document.getElementById("expand_button"),
    expand_button_triangle: document.getElementById("expand_button_triangle"),
    plus_button: document.getElementById("plus_button"),
    minus_button: document.getElementById("minus_button"),
    counter_button_container: document.getElementById("counter_buttons_container"),
}

export const is_mobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    random = (size) => Math.random() * size,
    easingFunction = bezier(0.45, 0.1, 0.25, 1);
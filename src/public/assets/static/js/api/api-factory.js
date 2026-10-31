export const get_particle_backend_factory = async (canvas) => {
    try {
        let supports_gpu = false;

        try {
            const probe_canvas = document.createElement("canvas");

            const gl = probe_canvas.getContext("webgl2", {
                alpha: true,
                antialias: false,
                powerPreference: "high-performance",
            });

            supports_gpu = Boolean(
                gl && gl.getExtension("EXT_color_buffer_float")
            );

            const lose_context = gl?.getExtension("WEBGL_lose_context");
            lose_context?.loseContext();

        } catch (_error) {
            supports_gpu = false;
        }

        console.info(supports_gpu ? "supports gpu" : "does not support gpu");

        if (supports_gpu) {
            const { default: WebGLBackend } = await import("./webgl2.js");
            return new WebGLBackend(canvas);
        } else {
            const { default: Canvas2DBackend } = await import("./fallback.js");
            return new Canvas2DBackend(canvas);
        }

    } catch (err) {
        console.error("Could not initialize the particle backend.", err);
        return;
    }
};
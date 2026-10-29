import WebGLBackend from "./webgl2.js";
import Canvas2DBackend from "./fallback.js";


export const get_particle_backend_factory = (canvas) => {
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
            // Release the temporary context where supported.
            console.info("remove temp context")
            const lose_context = gl?.getExtension("WEBGL_lose_context");
            lose_context?.loseContext();
        } catch (_error) {
            supports_gpu = false;
        }

        console.info(supports_gpu ? "supports gpu" : "does not support gpu");

        return supports_gpu 
            ? new WebGLBackend(canvas)
            : new Canvas2DBackend(canvas);
        
    } catch (err) {
        console.error("Could not initialize the particle backend.", err);
        return;
    }
}
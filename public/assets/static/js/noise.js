addEventListener("resize", (_) => {
    canvas.width = window.innerWidth;
    canvas.height = document.getElementsByClassName("fakeHeader")[0].offsetHeight;
});

const FRICTION = 0.6; const PARTICLE_SIZE = 5; const MIN_DISTANCE = 5; const MAX_DISTANCE = 30;
const canvas = document.getElementById("noise");
const button = document.getElementById("expand_button");
button.addEventListener("click", (_) => {
    const main = document.getElementsByTagName("main")[0];
    const height = canvas.height == 300 ? 73 : 300;
    document.getElementsByTagName("header")[0].style.height = `${height}px`;
    document.getElementsByClassName("fakeHeader")[0].style.height = `${height}px`;
    document.getElementById("expand_button_text").classList.toggle("triangle_rotate");
    main.style.marginTop = `${height}px`;
    canvas.height = height;
});
window.dispatchEvent(new CustomEvent("resize"));

const init = async () => {
    // ~~ INITIALIZE ~~ Make sure we can initialize WebGPU in the browser
    // https://carmencincotti.com/2022-04-18/drawing-a-webgpu-triangle/#adapter-and-device
    if (!navigator.gpu) {
      console.error(
        "WebGPU cannot be initialized - navigator.gpu not found"
      );
      return null;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error("WebGPU cannot be initialized - Adapter not found");
      return null;
    }
    const device = await adapter.requestDevice();
    device.lost.then(() => {
      console.error("WebGPU cannot be initialized - Device has been lost");
      return null;
    });

    const context = canvas.getContext("webgpu");
    if (!context) {
      console.error(
        "WebGPU cannot be initialized - Canvas does not support WebGPU"
      );
      return null;
    }

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
      device, 
      format: presentationFormat,
      alphaMode: "opaque"
    });

    const vertices = new Float32Array([
        -0.5, -0.5, 0, 1,   1, 0, 0, 1, 
         0.5, -0.5, 0, 1,   0, 1, 0, 1, 
        -0.5,  0.5, 0, 1,   0, 0, 1, 1, 
         0.5,  0.5, 0, 1,   1, 1, 0, 1, 
    ]);

    const vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();

    const vertexBuffersDescriptors = [
      {
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: "float32x4",
          },
          {
            shaderLocation: 1,
            offset: 16,
            format: "float32x4",
          },
        ],
        arrayStride: 32,
        stepMode: "vertex",
      },
    ];

    const shaderModule = device.createShaderModule({
      code: `
      struct VertexOut {
          @builtin(position) position : vec4<f32>,
          @location(0) color : vec4<f32>,
      };
      @vertex
      fn vertex_main(@location(0) position: vec4<f32>,
                  @location(1) color: vec4<f32>) -> VertexOut {
          var output : VertexOut;
          output.position = position;
          output.color = color;
          return output;
      } 
      @fragment
      fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32> {
          return fragData.color;
      } 
  `,
    });

    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vertex_main",
        buffers: vertexBuffersDescriptors,
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragment_main",
        targets: [{ format: presentationFormat, }],
      },
      primitive: {
        topology: "triangle-strip",
      },
    });

    const renderPassDescriptor = {
      colorAttachments: [
        {
          loadOp: "clear",
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }, 
          storeOp: "store", 
        },
      ],
    };

    function frame() {
      renderPassDescriptor.colorAttachments[0].view = context
        .getCurrentTexture()
        .createView();
      const commandEncoder = device.createCommandEncoder();

      const passEncoder =
        commandEncoder.beginRenderPass(renderPassDescriptor);

      passEncoder.setPipeline(pipeline);
      passEncoder.setVertexBuffer(0, vertexBuffer);

      passEncoder.draw(4);

      passEncoder.end();

      device.queue.submit([commandEncoder.finish()]);

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  };

  init();
const canvas=document.getElementById("noise");let ctx;const header=document.getElementsByTagName("header")[0],fake_header=document.getElementsByClassName("fakeHeader")[0],main=document.getElementsByTagName("main")[0],expand_button=document.getElementById("expand_button"),plus_button=document.getElementById("plus_button"),minus_button=document.getElementById("minus_button");let IS_EXPANDED=!1;const FRICTION=.4,PARTICLE_SIZE=5,MIN_DISTANCE=5,MAX_DISTANCE=30,MAX_PARTICLE_MULTIPLIER=30,CANVAS_MIN_HEIGHT=73,is_mobile=()=>/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),get_multiplier=()=>canvas.height==CANVAS_MIN_HEIGHT?1:CUSTOM_MULTIPLIER,get_canvas_height=()=>IS_EXPANDED?is_mobile()?window.innerHeight>>1:window.innerHeight:CANVAS_MIN_HEIGHT;random=a=>Math.random()*a,easingFunction=bezier(.45,.1,.25,1);let quadtree,CUSTOM_MULTIPLIER=is_mobile()?3:10;const particles=[];let positions,colors,saved_len=0;const attraction_dct={b:{b:.32,m:-.4,p:-.4},m:{b:.4,m:.1,p:-.2},p:{b:.4,m:0,p:-.15}};let draw_particles=()=>{},update_viewport=()=>{};const create_tree=()=>{quadtree=new QuadTree(new Rectangle(canvas.width/2,canvas.height/2,canvas.width,canvas.height));for(let a=0;a<particles.length;a++)quadtree.insert(particles[a])},particle=(a,d,e,f,c)=>({id:a,key:d,position:e,velocity:[0,0],color:f,bounds:c}),add_particles=(a,c,d,e)=>{for(let b=0;b<c;b++)particles.push(particle(particles.length,a,[random(canvas.width),random(canvas.height)],d,e))},create_particles=(a=1)=>{particles.length=0,add_particles("b",70*a,[.22,.45,.91,1,"#3875ea"],!0),add_particles("m",25*a,[1,0,1,1,"ff00ff"],!0),add_particles("p",150*a,[.65,.13,.38,1,"#a62161"],!1),create_tree()},calc_next_positions=()=>{var a=Math.abs;const b=canvas.width,c=canvas.height;for(let d=0;d<particles.length;d++){let e=0,f=0;const g=particles[d],h=new Rectangle(g.position[0],g.position[1],MAX_DISTANCE,MAX_DISTANCE),i=quadtree.query(h,[]);for(let h=0;h<i.length;h++){const j=i[h],k=attraction_dct[g.key][j.key];if(0==k)continue;let l,m;g.bounds||j.bounds?(l=g.position[0]-j.position[0],m=g.position[1]-j.position[1]):(l=a(g.position[0]-j.position[0]),m=a(g.position[1]-j.position[1]),l>b>>1&&(l=b-l),m>c>>1&&(m=c-m));const n=l*l+m*m;if(0==n||900<n)continue;const d=Math.sqrt(n),o=(d<=MIN_DISTANCE?.3:-k)/d;e+=o*l,f+=o*m}g.velocity[0]=(g.velocity[0]+e)*FRICTION,g.velocity[1]=(g.velocity[1]+f)*FRICTION,g.position[0]=(g.position[0]+g.velocity[0]+b)%b,g.position[1]=(g.position[1]+g.velocity[1]+c)%c}};let current_update_frame;const update_particles=()=>{calc_next_positions(),quadtree.update_tree(quadtree),quadtree.remove_nodes(),draw_particles(),current_update_frame=requestAnimationFrame(update_particles)},animate_header=(a,b,c)=>{if(1>=a){const d=b+(c-b)*easingFunction(a);canvas.height=d,header.style.height=fake_header.style.height=main.style.marginTop=`${d}px`,update_viewport(),requestAnimationFrame(()=>animate_header(a+.01,b,c)),create_particles(1),draw_particles()}else canvas.height=c,header.style.height=fake_header.style.height=main.style.marginTop=`${c}px`,update_viewport(),create_particles(get_multiplier()),update_particles()},init=()=>{if(ctx=canvas.getContext("webgl"),ctx){update_viewport=()=>{ctx.viewport(0,0,ctx.drawingBufferWidth,ctx.drawingBufferHeight)};const a=(a,b,c)=>{const d=a.createShader(b);return a.shaderSource(d,c),a.compileShader(d),a.getShaderParameter(d,a.COMPILE_STATUS)?d:(console.error("Shader compile error: ",a.getShaderInfoLog(d)),a.deleteShader(d),null)},b=a(ctx,ctx.VERTEX_SHADER,"\n            precision lowp float;\n            attribute vec2 a_position;\n            attribute vec4 a_color;\n            uniform vec2 u_resolution;\n            uniform float u_pointSize;\n            varying vec4 v_color;\n        \n            void main() {\n                vec2 zeroToOne = a_position / u_resolution;\n                vec2 zeroToTwo = zeroToOne * 2.0;\n                vec2 clipSpace = zeroToTwo - 1.0;\n        \n                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);\n                gl_PointSize  = u_pointSize;\n                v_color = a_color;\n            }\n        "),c=a(ctx,ctx.FRAGMENT_SHADER,`
            precision lowp float;
            varying vec4 v_color;

            void main() {
                gl_FragColor = v_color;
            }
        `),d=ctx.createProgram();if(ctx.attachShader(d,b),ctx.attachShader(d,c),ctx.linkProgram(d),!ctx.getProgramParameter(d,ctx.LINK_STATUS))return void console.error("Program linking error: ",ctx.getProgramInfoLog(d));const e=ctx.getAttribLocation(d,"a_position"),f=ctx.getAttribLocation(d,"a_color"),g=ctx.getUniformLocation(d,"u_resolution"),h=ctx.getUniformLocation(d,"u_pointSize"),i=ctx.createBuffer(),j=ctx.createBuffer();draw_particles=()=>{particles.length!==saved_len&&(positions=new Float32Array(particles.length<<1),colors=new Float32Array(particles.length<<2),saved_len=particles.length);for(let a=0;a<particles.length;a++){const b=particles[a];positions[a<<1]=b.position[0],positions[(a<<1)+1]=b.position[1],colors[a<<2]=b.color[0],colors[(a<<2)+1]=b.color[1],colors[(a<<2)+2]=b.color[2],colors[(a<<2)+3]=1}ctx.bindBuffer(ctx.ARRAY_BUFFER,i),ctx.bufferData(ctx.ARRAY_BUFFER,positions,ctx.DYNAMIC_DRAW),ctx.enableVertexAttribArray(e),ctx.vertexAttribPointer(e,2,ctx.FLOAT,!1,0,0),ctx.bindBuffer(ctx.ARRAY_BUFFER,j),ctx.bufferData(ctx.ARRAY_BUFFER,colors,ctx.DYNAMIC_DRAW),ctx.enableVertexAttribArray(f),ctx.vertexAttribPointer(f,4,ctx.FLOAT,!1,0,0),ctx.useProgram(d),ctx.uniform2f(g,canvas.width,canvas.height),ctx.uniform1f(h,PARTICLE_SIZE),ctx.clear(ctx.COLOR_BUFFER_BIT),ctx.drawArrays(ctx.position,0,particles.length)}}else{ctx=canvas.getContext("2d");const a=(a,b,d,c,e)=>{ctx.fillStyle=d,ctx.fillRect(a,b,c,e)};draw_particles=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);for(let b=0;b<particles.length;b++)a(particles[b].position[0],particles[b].position[1],particles[b].color[4],PARTICLE_SIZE,PARTICLE_SIZE)}}window.dispatchEvent(new CustomEvent("resize")),update_particles()};expand_button.addEventListener("click",a=>{IS_EXPANDED=!IS_EXPANDED;const b=get_canvas_height();document.getElementById("expand_button_triangle").classList.toggle("triangle_rotate"),is_mobile()||document.getElementById("counter").classList.toggle("invisible"),cancelAnimationFrame(current_update_frame),animate_header(0,canvas.height,b)}),plus_button.addEventListener("click",a=>{CUSTOM_MULTIPLIER>=MAX_PARTICLE_MULTIPLIER||(CUSTOM_MULTIPLIER++,minus_button.disabled=!1,minus_button.classList.remove("disabled"),create_particles(get_multiplier()),CUSTOM_MULTIPLIER>=MAX_PARTICLE_MULTIPLIER&&(plus_button.disabled=!0,plus_button.classList.add("disabled")))}),minus_button.addEventListener("click",a=>{1>=CUSTOM_MULTIPLIER||(plus_button.disabled=!1,plus_button.classList.remove("disabled"),CUSTOM_MULTIPLIER--,create_particles(get_multiplier()),1>=CUSTOM_MULTIPLIER&&(minus_button.disabled=!0,minus_button.classList.add("disabled")))}),addEventListener("resize",a=>{if(!(canvas.width===window.innerWidth&&(is_mobile()||canvas.innerHeight===get_canvas_height()))){canvas.width=window.innerWidth;const a=get_canvas_height();canvas.height=a,header.style.height=fake_header.style.height=main.style.marginTop=`${a}px`,update_viewport(),create_particles(get_multiplier())}}),addEventListener("load",init);
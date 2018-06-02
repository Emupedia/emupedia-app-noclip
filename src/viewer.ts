
// tslint:disable:no-console

import { mat4, vec3, vec4 } from 'gl-matrix';

import { RenderState, RenderFlags, ColorTarget, DepthTarget } from './render';
import * as UI from './ui';

import Progressable from 'Progressable';
import { InputManager } from './InputManager';
import { CameraController, Camera, CameraControllerClass } from './Camera';

export interface Texture {
    name: string;
    surfaces: HTMLCanvasElement[];
}

export interface Scene {
    textures: Texture[];
    render(state: RenderState): void;
    destroy(gl: WebGL2RenderingContext): void;
}

export class Viewer {
    public inputManager: InputManager;
    public cameraController: CameraController;

    public renderState: RenderState;
    private onscreenColorTarget: ColorTarget = new ColorTarget();
    private onscreenDepthTarget: DepthTarget = new DepthTarget();
    public scene: MainScene;
    
    public oncamerachanged: () => void = (() => {});

    constructor(public canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
        this.renderState = new RenderState(gl);

        this.inputManager = new InputManager(this.canvas);

        this.cameraController = null;
    }

    public reset() {
        const gl = this.renderState.gl;
        gl.activeTexture(gl.TEXTURE0);
        gl.clearColor(0.88, 0.88, 0.88, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.renderState.setClipPlanes(0.2, 50000);
    }

    public render() {
        const gl = this.renderState.gl;

        if (!this.scene)
            return;

        this.onscreenColorTarget.setParameters(gl, this.canvas.width, this.canvas.height);
        this.onscreenDepthTarget.setParameters(gl, this.canvas.width, this.canvas.height);
        this.renderState.setOnscreenRenderTarget(this.onscreenColorTarget, this.onscreenDepthTarget);
        this.renderState.reset();

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Main scene. This renders to the onscreen target.
        this.scene.render(this.renderState);

        // Blit to the screen.
        this.renderState.blitOnscreenToGL();

        const frameEndTime = window.performance.now();
        const diff = frameEndTime - this.renderState.frameStartTime;
        // console.log(`Time: ${diff} Draw calls: ${state.drawCallCount}`);
    }

    public setCameraController(cameraController: CameraController) {
        this.cameraController = cameraController;
        this.cameraController.camera = this.renderState.camera;
    }

    public setScene(scene: MainScene) {
        const gl = this.renderState.gl;

        this.reset();

        if (this.scene) {
            this.scene.destroy(gl);
        }

        if (scene) {
            this.scene = scene;
            this.oncamerachanged();
        } else {
            this.scene = null;
        }
    }

    public start() {
        const canvas = this.canvas;

        let t = 0;
        const update = (nt: number) => {
            const dt = nt - t;
            t = nt;

            if (this.cameraController) {
                const updated = this.cameraController.update(this.inputManager, dt);
                if (updated)
                    this.oncamerachanged();
            }

            this.inputManager.resetMouse();

            this.renderState.time += dt;
            this.render();

            window.requestAnimationFrame(update);
        };
        update(0);
    }
}

export interface MainScene extends Scene {
    resetCamera?(camera: Camera): void;
    createPanels?(): UI.Panel[];
}

export interface SceneDesc {
    id: string;
    name: string;
    createScene(gl: WebGL2RenderingContext): Progressable<MainScene>;
    defaultCameraController?: CameraControllerClass;
}

export interface SceneGroup {
    id: string;
    name: string;
    sceneDescs: SceneDesc[];
}

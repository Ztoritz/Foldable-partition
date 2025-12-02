import * as THREE from 'three';

export class Vikvagg {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.panels = [];
        this.params = {
            sections: 3,
            width: 0.8, // Width per panel
            height: 2.1,
            thickness: 0.04,
            frameWidth: 0.08, // Width of the frame border
            foldAngle: 30, // Degrees
            frameColor: 0x2a2a2a, // Dark grey aluminum
            glassColor: 0xffffff,
            glassOpacity: 0.2,
            metalness: 0.8,
            roughness: 0.2
        };

        // High quality materials
        this.materialFrame = new THREE.MeshStandardMaterial({
            color: this.params.frameColor,
            metalness: this.params.metalness,
            roughness: this.params.roughness,
            side: THREE.DoubleSide
        });

        this.materialGlass = new THREE.MeshPhysicalMaterial({
            color: this.params.glassColor,
            metalness: 0.1,
            roughness: 0.05,
            transmission: 0.95,
            thickness: 0.01,
            transparent: true,
            opacity: this.params.glassOpacity,
            ior: 1.5,
            side: THREE.DoubleSide
        });

        this.generate();
    }

    update(newParams) {
        Object.assign(this.params, newParams);

        // Update materials
        this.materialFrame.color.setHex(this.params.frameColor);
        this.materialFrame.metalness = this.params.metalness;
        this.materialFrame.roughness = this.params.roughness;

        this.materialGlass.color.setHex(this.params.glassColor);
        this.materialGlass.opacity = this.params.glassOpacity;

        this.generate();
    }

    generate() {
        console.log("Generating Vikvagg with params:", this.params);
        // Clear existing
        while (this.group.children.length > 0) {
            this.group.remove(this.group.children[0]);
        }
        this.panels = [];

        // Re-create geometry to match params
        // Frame Geometry (Box with hole? Or 4 boxes?)
        // Let's use 4 boxes for the frame to allow easy resizing without stretching UVs or complex CSG.

        const pW = this.params.width;
        const pH = this.params.height;
        const pT = this.params.thickness;
        const fW = this.params.frameWidth;

        // Vertical stiles
        const stileGeo = new THREE.BoxGeometry(fW, pH, pT);
        // Horizontal rails
        const railGeo = new THREE.BoxGeometry(pW - 2 * fW, fW, pT);

        // Glass
        const glassGeo = new THREE.PlaneGeometry(pW - 2 * fW, pH - 2 * fW);

        for (let i = 0; i < this.params.sections; i++) {
            const panelGroup = new THREE.Group();

            // Left Stile
            const leftStile = new THREE.Mesh(stileGeo, this.materialFrame);
            leftStile.position.set(fW / 2, 0, 0);
            leftStile.castShadow = true;
            leftStile.receiveShadow = true;
            panelGroup.add(leftStile);

            // Right Stile
            const rightStile = new THREE.Mesh(stileGeo, this.materialFrame);
            rightStile.position.set(pW - fW / 2, 0, 0);
            rightStile.castShadow = true;
            rightStile.receiveShadow = true;
            panelGroup.add(rightStile);

            // Top Rail
            const topRail = new THREE.Mesh(railGeo, this.materialFrame);
            topRail.position.set(pW / 2, pH / 2 - fW / 2, 0);
            topRail.castShadow = true;
            topRail.receiveShadow = true;
            panelGroup.add(topRail);

            // Bottom Rail
            const bottomRail = new THREE.Mesh(railGeo, this.materialFrame);
            bottomRail.position.set(pW / 2, -pH / 2 + fW / 2, 0);
            bottomRail.castShadow = true;
            bottomRail.receiveShadow = true;
            panelGroup.add(bottomRail);

            // Glass
            const glass = new THREE.Mesh(glassGeo, this.materialGlass);
            glass.position.set(pW / 2, 0, 0);
            panelGroup.add(glass);

            // Hinge Visuals (Cylinders)
            const hingeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.1, 16);
            const hingeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1.0, roughness: 0.2 });

            // Add hinges at top and bottom of left side (pivot side)
            const hingeTop = new THREE.Mesh(hingeGeo, hingeMat);
            hingeTop.position.set(0, pH / 2 - 0.2, 0);
            panelGroup.add(hingeTop);

            const hingeBottom = new THREE.Mesh(hingeGeo, hingeMat);
            hingeBottom.position.set(0, -pH / 2 + 0.2, 0);
            panelGroup.add(hingeBottom);


            // Position logic
            if (i === 0) {
                this.group.add(panelGroup);
            } else {
                panelGroup.position.x = pW;
                this.panels[i - 1].add(panelGroup);
            }

            this.panels.push(panelGroup);
        }

        this.updateFolding();
    }

    updateFolding() {
        const angleRad = THREE.MathUtils.degToRad(this.params.foldAngle);

        this.panels.forEach((panel, index) => {
            if (index > 0) {
                // Zig-zag folding
                // Even indices rotate one way, odd rotate the other?
                // Panel 0 is fixed (or rotates relative to wall).
                // Panel 1 rotates relative to Panel 0.

                // Simple zig-zag:
                // Panel 1 rotates +angle relative to Panel 0
                // Panel 2 rotates -angle relative to Panel 1? 
                // Actually, for a concertina, the angle between panels is what matters.
                // If fully open (flat), angle is 0.
                // If folded, angle is e.g. 90 or 180.

                // Let's say foldAngle is the angle *between* panels.
                // Relative rotation:
                // Panel 1: +angle
                // Panel 2: -angle
                // Panel 3: +angle

                const dir = index % 2 === 0 ? 1 : -1;
                panel.rotation.y = dir * angleRad;
            }
        });
    }
}

import * as THREE from 'three';

export class VV {
    constructor(scene) {
        this.scene = scene;
        this.wallGroup = new THREE.Group();
        this.scene.add(this.wallGroup);

        this.wheelGroup = new THREE.Group();
        this.wallGroup.add(this.wheelGroup);
        this.wheels = []; // Store wheel objects and their target panels

        // State
        this.state = {
            totalLength: 2000, // mm (Includes legs + gap + wall)
            height: 2500,      // mm
            sections: 3,
            hingeGap: 5,       // mm
            thickness: 80,     // mm
            legWidth: 50,      // mm - Support leg profile width
            isFolded: false,
            foldAngle: 0,      // Current angle
            targetAngle: 0,    // Target angle
            foldDirection: 1   // 1: Front Fold (CW), -1: Back Fold (CCW)
        };

        // Materials
        this.materialFrame = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.7
        });
        this.materialPaint = new THREE.MeshStandardMaterial({
            color: 0xeeeeee,
            roughness: 0.2, // Glossy
            metalness: 0.1  // Paint
        });
        this.materialHinge = new THREE.MeshStandardMaterial({ color: 0x111111 });
        this.materialWheel = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }); // Black puck
        this.materialLeg = this.materialPaint;

        this.generate();
    }

    setDimensions(length, height, sections) {
        this.state.totalLength = length;
        this.state.height = height;
        this.state.sections = sections;

        // Reset animation
        this.state.isFolded = false;
        this.state.targetAngle = 0;
        this.state.foldAngle = 0;

        this.generate();
    }

    foldFront() {
        this.state.foldDirection = 1;
        this.generate();
        this.state.targetAngle = Math.PI / 2;
    }

    foldBack() {
        this.state.foldDirection = -1;
        this.generate();
        this.state.targetAngle = Math.PI / 2;
    }

    unfold() {
        this.state.targetAngle = 0;
    }

    toggleFold() {
        if (this.state.targetAngle > 0.1) {
            this.unfold();
        } else {
            if (this.state.foldDirection === 1) this.foldFront();
            else this.foldBack();
        }
    }

    calculateDimensions() {
        const L = this.state.totalLength;
        const N = this.state.sections;
        const G = this.state.hingeGap;
        const T = this.state.thickness;
        const LegW = this.state.legWidth;

        // Effective Wall Length = Total - 2*Legs - Gap(Left)
        // Note: The Gap(Left) is the hinge gap between Left Leg and First Section.
        const effectiveL = L - 2 * LegW - G;

        // Formula: W = (EffectiveL - (N-1)G) / (N - 0.5)
        const w = (effectiveL - (N - 1) * G) / (N - 0.5);

        return {
            standardWidth: w,
            firstWidth: w / 2,
            gap: G,
            thickness: T,
            legWidth: LegW
        };
    }

    getPanelSequence(sections, direction) {
        const sequence = [];
        if (direction === 1) { // Front
            sequence.push('1/2FB');
            for (let i = 1; i < sections; i++) {
                if (i === sections - 1) {
                    sequence.push('FBD');
                } else {
                    if (i % 2 !== 0) sequence.push('BWF');
                    else sequence.push('FB');
                }
            }
        } else { // Back
            sequence.push('1/2BF');
            for (let i = 1; i < sections; i++) {
                if (i === sections - 1) {
                    sequence.push('BFD');
                } else {
                    if (i % 2 !== 0) sequence.push('FWB');
                    else sequence.push('BF');
                }
            }
        }
        return sequence;
    }

    createPanel(type, width, height, thickness) {
        const panelGroup = new THREE.Group();

        let isLFRB = false;
        let hasWheel = false;

        if (['1/2FB', 'FB', 'FWB', 'FBD'].includes(type)) {
            isLFRB = true;
        }
        if (['FWB', 'BWF'].includes(type)) {
            hasWheel = true;
        }

        const w = width;
        const h = height;
        const t = thickness;
        const frameW = 10;
        const frameT = t;

        const leftZ = isLFRB ? t / 2 : -t / 2;
        const rightZ = isLFRB ? -t / 2 : t / 2;

        // Frame
        const material = this.materialFrame;

        // Top Rail
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(w, frameW, frameT), material);
        topRail.position.y = h / 2 - frameW / 2;
        topRail.castShadow = true;
        panelGroup.add(topRail);

        // Bottom Rail
        const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(w, frameW, frameT), material);
        bottomRail.position.y = -h / 2 + frameW / 2;
        bottomRail.castShadow = true;
        panelGroup.add(bottomRail);

        // Stiles
        const stileH = h - 2 * frameW;
        const leftStile = new THREE.Mesh(new THREE.BoxGeometry(frameW, stileH, frameT), material);
        leftStile.position.set(-w / 2 + frameW / 2, 0, 0);
        leftStile.castShadow = true;
        panelGroup.add(leftStile);

        const rightStile = new THREE.Mesh(new THREE.BoxGeometry(frameW, stileH, frameT), material);
        rightStile.position.set(w / 2 - frameW / 2, 0, 0);
        rightStile.castShadow = true;
        panelGroup.add(rightStile);

        // Infill
        const infillW = w - 2 * frameW;
        if (infillW > 0) {
            const infill = new THREE.Mesh(new THREE.BoxGeometry(infillW, stileH, t - 4), this.materialPaint);
            infill.castShadow = true;
            panelGroup.add(infill);
        }

        // Store Metadata
        panelGroup.userData = {
            type: type,
            width: w,
            leftZ: leftZ,
            rightZ: rightZ,
            isPanel: true,
            hasWheel: hasWheel // Flag for generate/update to handle
        };

        return panelGroup;
    }

    generate() {
        while (this.wallGroup.children.length > 0) {
            this.wallGroup.remove(this.wallGroup.children[0]);
        }
        // Re-add wheelGroup since we cleared wallGroup
        this.wheelGroup = new THREE.Group();
        this.wallGroup.add(this.wheelGroup);
        this.wheels = [];

        const dims = this.calculateDimensions();
        const sequence = this.getPanelSequence(this.state.sections, this.state.foldDirection);

        // Update UI Result
        const resStd = document.getElementById('res-std-width');
        const resFirst = document.getElementById('res-first-width');
        if (resStd) resStd.textContent = Math.round(dims.standardWidth) + ' mm';
        if (resFirst) resFirst.textContent = Math.round(dims.firstWidth) + ' mm';

        const h = this.state.height;
        const t = dims.thickness;
        const g = dims.gap;
        const legW = dims.legWidth;

        // Wall Start (Centered)
        const totalLenM = this.state.totalLength;
        const startX = -totalLenM / 2;
        // Wall Group at Floor Level (Y=0)
        this.wallGroup.position.set(startX, 0, 0);

        // Vertical Dimensions
        const H_total = h;
        const H_track = 50; // 50mm
        const H_leg = H_total - H_track; // Legs go up to bottom of track
        const Gap_floor = 10; // 10mm
        const Gap_track = 10; // 10mm
        const H_panel = H_total - H_track - Gap_track - Gap_floor;

        // Subframe (Top Track)
        // Track rests on legs. Top of track is at H_total.
        // Center Y = H_total - H_track/2
        const trackGeo = new THREE.BoxGeometry(totalLenM, H_track, 50);
        const track = new THREE.Mesh(trackGeo, this.materialPaint);
        track.position.set(totalLenM / 2, H_total - H_track / 2, 0);
        this.wallGroup.add(track);

        // Support Legs
        // Legs start at 0 and go to H_leg.
        // Center Y = H_leg / 2.
        const legGeo = new THREE.BoxGeometry(legW, H_leg, 50);

        // Left Leg
        const leftLeg = new THREE.Mesh(legGeo, this.materialLeg);
        leftLeg.position.set(legW / 2, H_leg / 2, 0);
        this.wallGroup.add(leftLeg);

        // Right Leg
        const rightLeg = new THREE.Mesh(legGeo, this.materialLeg);
        rightLeg.position.set(totalLenM - legW / 2, H_leg / 2, 0);
        this.wallGroup.add(rightLeg);

        // Build Panels
        const wallStartX = legW + g;

        let currentParent = this.wallGroup;

        const firstType = sequence[0];
        const firstIsLFRB = ['1/2FB', 'FB'].includes(firstType);
        const rootPivotZ = firstIsLFRB ? t / 2 : -t / 2;

        const rootPivot = new THREE.Group();
        // Pivot Y should be at center of panel? Or 0?
        // If we put Pivot at 0, we must offset panel Y in createPanel or here.
        // Let's put Pivot at Panel Center Y to simplify rotation.
        const panelCenterY = Gap_floor + H_panel / 2;

        rootPivot.position.set(wallStartX, panelCenterY, rootPivotZ);
        this.wallGroup.add(rootPivot);

        currentParent = rootPivot;

        for (let i = 0; i < sequence.length; i++) {
            const type = sequence[i];
            const isHalf = type.startsWith('1/2');
            const width = isHalf ? dims.firstWidth : dims.standardWidth;

            // Create Panel with H_panel
            const panel = this.createPanel(type, width, H_panel, this.state.thickness);
            const w = panel.userData.width;
            const leftZ = panel.userData.leftZ;
            const rightZ = panel.userData.rightZ;

            // Offset for subsequent panels to account for pivot in center of gap
            const offset = (i === 0) ? 0 : g / 2;

            // Panel is already centered at (0,0,0) in its local space.
            // Pivot is at Panel Center Y.
            // So Panel Local Y should be 0.
            panel.position.set(w / 2 + offset, 0, -leftZ);

            currentParent.add(panel);

            // Handle Wheel
            if (panel.userData.hasWheel) {
                const wheelGeo = new THREE.CylinderGeometry(20, 20, 40, 32);
                const wheel = new THREE.Mesh(wheelGeo, this.materialWheel);
                // Initial Pos (will be updated in update())
                this.wheelGroup.add(wheel);
                this.wheels.push({ mesh: wheel, panel: panel });
            }

            // Prepare Next Pivot
            if (i < sequence.length - 1) {
                const nextPivotX = (i === 0) ? (w + g / 2) : (w + g);
                const nextPivotZ = (rightZ - leftZ);

                const nextPivot = new THREE.Group();
                nextPivot.position.set(nextPivotX, 0, nextPivotZ); // Relative to current pivot (which is at Panel Center Y)

                // Visual Hinge
                // Hinge should span the panel height?
                const hingeGeo = new THREE.CylinderGeometry(5, 5, H_panel, 16);
                const hinge = new THREE.Mesh(hingeGeo, this.materialHinge);
                hinge.position.set(nextPivotX, 0, nextPivotZ);
                currentParent.add(hinge);

                currentParent.add(nextPivot);
                currentParent = nextPivot;
            }
        }
    }

    update() {
        const speed = 0.05;
        if (Math.abs(this.state.foldAngle - this.state.targetAngle) > 0.001) {
            this.state.foldAngle += (this.state.targetAngle - this.state.foldAngle) * speed;

            const baseAngle = this.state.foldAngle * -this.state.foldDirection;

            if (this.wallGroup.children.length > 4) {
                // Indices:
                // 0: wheelGroup
                // 1: Track
                // 2: LeftLeg
                // 3: RightLeg
                // 4: RootPivot

                const rootPivot = this.wallGroup.children[4];

                if (rootPivot) {
                    // P0 Rotation
                    rootPivot.rotation.y = baseAngle;

                    // Propagate
                    let ptr = rootPivot;
                    let direction = -1;

                    let safeGuard = 0;
                    while (ptr && safeGuard < 50) {
                        safeGuard++;
                        const panel = ptr.children.find(c => c.userData.isPanel);
                        if (!panel) break;

                        const nextPivot = ptr.children.find(c => c.type === 'Group' && !c.userData.isPanel);

                        if (nextPivot) {
                            nextPivot.rotation.y = baseAngle * 2 * direction;
                            direction *= -1;
                            ptr = nextPivot;
                        } else {
                            break;
                        }
                    }
                }
            }
        }

        // Update Wheels
        this.wheels.forEach(item => {
            const panel = item.panel;
            const wheel = item.mesh;

            // Target X calculation
            const target = new THREE.Vector3(0, 0, 0); // Panel Center (Local)
            this.wallGroup.updateMatrixWorld(true);
            target.applyMatrix4(panel.matrixWorld);
            this.wheelGroup.worldToLocal(target);

            // Wheel Y Position
            // Panel Top Y (Local to WallGroup) = Gap_floor + H_panel
            // Wheel sits on top. Center Y = Panel Top + WheelHeight/2
            // Wheel Height = 0.1 (100mm). Half = 0.05.
            // But verify: H_panel calculation uses h (Total Height).
            // H_panel = h - 0.05 - 0.01 - 0.01.
            // Panel Top = 0.01 + H_panel = h - 0.06.
            // Wheel Y = (h - 0.06) + 0.05 = h - 0.01.
            // Track Bottom is h - 0.05.
            // So Wheel Center is 40mm INSIDE the track (starts at h-0.05, goes to h).
            // Wheel Top = h - 0.01 + 0.05 = h + 0.04.
            // Wheel Bottom = h - 0.01 - 0.05 = h - 0.06.
            // This seems reasonable if it runs inside.

            // Recalculate based on current state.height
            const h = this.state.height;
            const H_track = 50;
            const Gap_track = 10;
            const Gap_floor = 10;
            const H_panel = h - H_track - Gap_track - Gap_floor;

            const panelTopY = Gap_floor + H_panel;
            const wheelY = h - H_track / 2;

            wheel.position.set(target.x, wheelY, 0);
        });
    }

    updateColor(hex) {
        this.materialPaint.color.set(hex);
    }
}

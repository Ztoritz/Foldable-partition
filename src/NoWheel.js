import * as THREE from 'three';

export class NoWheel {
    constructor(scene) {
        this.scene = scene;
        this.wallGroup = new THREE.Group();
        this.scene.add(this.wallGroup);

        // State
        this.state = {
            totalLength: 2000, // mm
            height: 2500,      // mm
            sections: 3,
            hingeGap: 6.4,     // mm
            thickness: 80,     // mm
            isFolded: false,
            foldAngle: 0,      // Current angle
            targetAngle: 0,    // Target angle
            foldDirection: -1  // -1: Backwards (LB start), 1: Forwards (LF start)
        };

        // Materials
        this.materialFrame = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.7
        });
        this.materialWall = new THREE.MeshStandardMaterial({
            color: 0xeeeeee,
            roughness: 0.2,
            metalness: 0.1
        });
        this.materialHinge = new THREE.MeshStandardMaterial({ color: 0x111111 });
        this.materialHandle = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });

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
        this.generate(); // Regenerate to set pivots
        this.state.targetAngle = Math.PI / 2;
    }

    foldBack() {
        this.state.foldDirection = -1;
        this.generate(); // Regenerate to set pivots
        this.state.targetAngle = Math.PI / 2;
    }

    unfold() {
        this.state.targetAngle = 0;
    }

    toggleFold() {
        if (this.state.targetAngle > 0.1) {
            this.unfold();
        } else {
            this.foldBack();
        }
    }

    calculateDimensions() {
        const L = this.state.totalLength;
        const N = this.state.sections;
        const G = this.state.hingeGap;
        const T = this.state.thickness;

        const num = L - (N - 1) * G;
        const standardWidth = num / N;
        const firstWidth = standardWidth;

        return {
            standardWidth: standardWidth,
            firstWidth: firstWidth,
            gap: G,
            thickness: T
        };
    }

    generateSubFrame(h, totalLenM, t) {
        const subFrameGroup = new THREE.Group();

        const profileW = 0.08;
        const profileD = 0.09;
        const rightGap = 0.01;
        const topGap = 0.01;

        const materialSubFrame = this.materialFrame;
        const materialSeal = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

        const jambH = h + topGap;

        // 1. Left Jamb
        const leftJambGeo = new THREE.BoxGeometry(profileW, jambH, profileD);
        const leftJamb = new THREE.Mesh(leftJambGeo, materialSubFrame);
        leftJamb.position.set(-profileW / 2, topGap / 2, 0);
        leftJamb.castShadow = true;
        leftJamb.receiveShadow = true;
        subFrameGroup.add(leftJamb);

        // 2. Right Jamb
        const rightJambGeo = new THREE.BoxGeometry(profileW, jambH, profileD);
        const rightJamb = new THREE.Mesh(rightJambGeo, materialSubFrame);
        const rightJambX = totalLenM + rightGap + profileW / 2;
        rightJamb.position.set(rightJambX, topGap / 2, 0);
        rightJamb.castShadow = true;
        rightJamb.receiveShadow = true;
        subFrameGroup.add(rightJamb);

        // 3. Top Rail
        const topRailWidth = totalLenM + rightGap + 2 * profileW;
        const topRailGeo = new THREE.BoxGeometry(topRailWidth, profileW, profileD);
        const topRail = new THREE.Mesh(topRailGeo, materialSubFrame);
        topRail.position.set((totalLenM + rightGap) / 2, h / 2 + topGap + profileW / 2, 0);
        topRail.castShadow = true;
        topRail.receiveShadow = true;
        subFrameGroup.add(topRail);

        // 4. Rubber Seal
        const sealGeo = new THREE.BoxGeometry(totalLenM, topGap, t);
        const seal = new THREE.Mesh(sealGeo, materialSeal);
        seal.position.set(totalLenM / 2, h / 2 + topGap / 2, 0);
        subFrameGroup.add(seal);

        return subFrameGroup;
    }

    generate() {
        // Clear existing
        while (this.wallGroup.children.length > 0) {
            this.wallGroup.remove(this.wallGroup.children[0]);
        }

        const dims = this.calculateDimensions();

        // Update UI Result (Direct DOM manipulation kept for now, ideally should be callback)
        const resStd = document.getElementById('res-std-width');
        const resFirst = document.getElementById('res-first-width');
        if (resStd) resStd.textContent = Math.round(dims.standardWidth) + ' mm';
        if (resFirst) resFirst.textContent = Math.round(dims.firstWidth) + ' mm';

        const h = this.state.height / 1000;
        const t = dims.thickness / 1000;
        const g = dims.gap / 1000;

        const frameW = 0.01;
        const frameProtrusion = 0.002;
        const frameT = t + 2 * frameProtrusion;

        const hingeGeo = new THREE.CylinderGeometry(0.005, 0.005, h, 16);

        // Wall Start Position
        const totalLenM = this.state.totalLength / 1000;
        const startX = -totalLenM / 2;

        this.wallGroup.position.x = startX;
        this.wallGroup.position.y = h / 2;

        const rootPivotZ = this.state.foldDirection * t / 2;

        const rootPivot = new THREE.Group();
        rootPivot.position.set(0, 0, rootPivotZ);
        this.wallGroup.add(rootPivot);

        // Sub Frame
        const subFrame = this.generateSubFrame(h, totalLenM, t);
        this.wallGroup.add(subFrame);

        let currentParent = rootPivot;
        let currentPivotZ = rootPivotZ;

        for (let i = 0; i < this.state.sections; i++) {
            const panelGroup = new THREE.Group();

            const widthMM = (i === 0) ? dims.firstWidth : dims.standardWidth;
            const w = widthMM / 1000;
            const meshOffsetZ = -currentPivotZ;
            const panelCenterX = g / 2 + w / 2;

            // 1. Top Rail
            const topRailGeo = new THREE.BoxGeometry(w, frameW, frameT);
            const topRail = new THREE.Mesh(topRailGeo, this.materialFrame);
            topRail.position.set(panelCenterX, h / 2 - frameW / 2, meshOffsetZ);
            topRail.castShadow = true;
            topRail.receiveShadow = true;
            panelGroup.add(topRail);

            // 2. Bottom Rail
            const bottomRailGeo = new THREE.BoxGeometry(w, frameW, frameT);
            const bottomRail = new THREE.Mesh(bottomRailGeo, this.materialFrame);
            bottomRail.position.set(panelCenterX, -h / 2 + frameW / 2, meshOffsetZ);
            bottomRail.castShadow = true;
            bottomRail.receiveShadow = true;
            panelGroup.add(bottomRail);

            // 3. Left Stile
            const stileH = h - 2 * frameW;
            const stileGeo = new THREE.BoxGeometry(frameW, stileH, frameT);
            const leftStile = new THREE.Mesh(stileGeo, this.materialFrame);
            leftStile.position.set(panelCenterX - w / 2 + frameW / 2, 0, meshOffsetZ);
            leftStile.castShadow = true;
            leftStile.receiveShadow = true;
            panelGroup.add(leftStile);

            // 4. Right Stile
            const rightStile = new THREE.Mesh(stileGeo, this.materialFrame);
            rightStile.position.set(panelCenterX + w / 2 - frameW / 2, 0, meshOffsetZ);
            rightStile.castShadow = true;
            rightStile.receiveShadow = true;
            panelGroup.add(rightStile);

            // 5. Infill
            const infillW = w - 2 * frameW;
            const infillH = h - 2 * frameW;
            if (infillW > 0) {
                const infillGeo = new THREE.BoxGeometry(infillW, infillH, t);
                const infill = new THREE.Mesh(infillGeo, this.materialWall);
                infill.position.set(panelCenterX, 0, meshOffsetZ);
                infill.castShadow = true;
                infill.receiveShadow = true;
                panelGroup.add(infill);
            }

            // 6. Handle (REMOVED)

            currentParent.add(panelGroup);

            if (i < this.state.sections - 1) {
                const nextPivotZ = -currentPivotZ;
                const hinge = new THREE.Mesh(hingeGeo, this.materialHinge);
                const nextPivotX = w + g;
                const pivotZDelta = nextPivotZ - currentPivotZ;

                const nextPivot = new THREE.Group();
                nextPivot.position.set(nextPivotX, 0, pivotZDelta);
                panelGroup.add(nextPivot);

                hinge.position.set(nextPivotX, 0, pivotZDelta);
                panelGroup.add(hinge);

                currentParent = nextPivot;
                currentPivotZ = nextPivotZ;
                panelGroup.userData.isPanel = true;
            } else {
                panelGroup.userData.isPanel = true;
            }
        }
    }

    update() {
        const speed = 0.05;
        if (Math.abs(this.state.foldAngle - this.state.targetAngle) > 0.001) {
            this.state.foldAngle += (this.state.targetAngle - this.state.foldAngle) * speed;

            if (this.wallGroup.children.length > 0) {
                // The first child is rootPivot, second is subFrame. 
                // We need to find rootPivot. It was added first.
                const rootPivot = this.wallGroup.children[0];
                // Check if it's the group we want (it has children)

                const angle = -this.state.foldAngle * this.state.foldDirection;
                rootPivot.rotation.y = angle;

                let ptr = rootPivot;
                if (ptr.children.length > 0) {
                    let panelGroup = ptr.children.find(c => c.type === 'Group' && c.userData.isPanel);
                    let i = 0;

                    while (panelGroup) {
                        const nextPivot = panelGroup.children.find(c => c.type === 'Group' && !c.userData.isPanel);

                        if (nextPivot) {
                            const sign = (i % 2 === 0) ? -1 : 1;
                            nextPivot.rotation.y = angle * 2 * sign;

                            if (nextPivot.children.length > 0) {
                                panelGroup = nextPivot.children.find(c => c.type === 'Group' && c.userData.isPanel);
                                i++;
                            } else {
                                panelGroup = null;
                            }
                        } else {
                            panelGroup = null;
                        }
                    }
                }
            }
        }
    }
}

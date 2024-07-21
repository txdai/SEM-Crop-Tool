// static/edit.js
let canvas, points = [], mode = 'select', currentShape = [], isDrawing = false;

document.addEventListener('DOMContentLoaded', function () {
    initializeCanvas();
    attachEventListeners();
    updateInstructions();
});

function initializeCanvas() {
    if (canvas) {
        canvas.dispose();
    }
    canvas = new fabric.Canvas('imageCanvas');

    fabric.Image.fromURL('/static/original.png?t=' + new Date().getTime(), function (img) {
        const maxWidth = 800;
        const scale = maxWidth / img.width;
        originalImageWidth = img.width;
        originalImageHeight = img.height;
        canvas.setWidth(img.width * scale);
        canvas.setHeight(img.height * scale);
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
            scaleX: scale,
            scaleY: scale
        });

        adjustLayout();
    });
}

function attachEventListeners() {
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    document.getElementById('transformBtn').addEventListener('click', applyTransform);
    document.getElementById('processBtn').addEventListener('click', processImage);
    document.getElementById('resetBtn').addEventListener('click', resetCanvas);
}

function adjustLayout() {
    const mainContainer = document.getElementById('mainContainer');
    const instructions = document.getElementById('instructions');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    mainContainer.style.width = `${canvasWidth + 40}px`; // Add some padding
    mainContainer.style.minHeight = `${canvasHeight + 250}px`; // Add more space for instructions and buttons
    instructions.style.width = `${canvasWidth}px`;
}

function updateInstructions() {
    const instructions = document.getElementById('instructions');
    if (mode === 'select') {
        let pointOrder;
        switch (points.length) {
            case 0:
                pointOrder = "top-left";
                break;
            case 1:
                pointOrder = "top-right";
                break;
            case 2:
                pointOrder = "bottom-right";
                break;
            case 3:
                pointOrder = "bottom-left";
                break;
            default:
                pointOrder = "";
        }

        instructions.innerHTML = `
            Select 4 points for transformation in this order:<br>
            1. Top-left &nbsp; 2. Top-right &nbsp; 3. Bottom-right &nbsp; 4. Bottom-left<br>
            Points selected: ${points.length}/4<br>
            ${points.length < 4 ? `Next point: <strong>${pointOrder}</strong>` : ''}
        `;
    } else if (mode === 'draw') {
        instructions.textContent = 'Click to add points. Click near the first point to close the shape.';
    }
}

function handleMouseDown(event) {
    const pointer = canvas.getPointer(event.e);
    if (mode === 'select' && points.length < 4) {
        addSelectionPoint(pointer);
    } else if (mode === 'draw') {
        handleDrawingMouseDown(pointer);
    }
    canvas.renderAll();
}

function addSelectionPoint(pointer) {
    const circle = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 5,
        fill: 'red',
        selectable: false,
        originX: 'center',
        originY: 'center'
    });

    // Add a text label next to the point
    const label = new fabric.Text((points.length + 1).toString(), {
        left: pointer.x + 10,
        top: pointer.y + 10,
        fontSize: 16,
        fill: 'red'
    });

    canvas.add(circle);
    canvas.add(label);
    points.push({ x: pointer.x * (originalImageWidth / canvas.width), y: pointer.y * (originalImageHeight / canvas.height) });

    updateInstructions();

    if (points.length === 4) {
        document.getElementById('transformBtn').style.display = 'inline';
    }
}


function handleDrawingMouseDown(pointer) {
    if (currentShape.length === 0) {
        startNewShape(pointer);
    } else if (isNearFirstPoint(pointer)) {
        completeShape();
    } else {
        addPoint(pointer);
    }
}

function isNearFirstPoint(pointer) {
    if (currentShape.length > 0) {
        const firstPoint = currentShape[0];
        const distance = Math.sqrt(Math.pow(pointer.x - firstPoint.left, 2) + Math.pow(pointer.y - firstPoint.top, 2));
        return distance < 10;  // Consider "near" if within 10 pixels
    }
    return false;
}

function handleMouseMove(event) {
    if (mode === 'draw' && currentShape.length > 0) {
        const pointer = canvas.getPointer(event.e);
        if (currentShape.length > 1) {
            const lastLine = currentShape[currentShape.length - 1];
            lastLine.set({ x2: pointer.x, y2: pointer.y });
        }
        canvas.renderAll();
    }
}

function handleMouseUp(event) {
    // This function can remain empty if we don't need specific mouseup handling
}

function startNewShape(pointer) {
    const circle = new fabric.Circle({
        radius: 5,
        fill: 'green',
        left: pointer.x,
        top: pointer.y,
        selectable: false,
        originX: 'center',
        originY: 'center'
    });
    canvas.add(circle);
    currentShape.push(circle);
}

function addPoint(pointer) {
    const lastPoint = currentShape[currentShape.length - 1];
    const line = new fabric.Line([
        lastPoint.left, lastPoint.top,
        pointer.x, pointer.y
    ], {
        stroke: 'green',
        strokeWidth: 2,
        selectable: false
    });
    canvas.add(line);
    currentShape.push(line);

    const point = new fabric.Circle({
        radius: 5,
        fill: 'green',
        left: pointer.x,
        top: pointer.y,
        selectable: false,
        originX: 'center',
        originY: 'center'
    });
    canvas.add(point);
    currentShape.push(point);
}

function completeShape() {
    if (currentShape.length < 3) return;  // Need at least 3 points to form a shape

    const firstPoint = currentShape[0];
    const lastPoint = currentShape[currentShape.length - 1];
    const closingLine = new fabric.Line([
        lastPoint.left, lastPoint.top,
        firstPoint.left, firstPoint.top
    ], {
        stroke: 'green',
        strokeWidth: 2,
        selectable: false
    });
    canvas.add(closingLine);

    const points = currentShape.filter(obj => obj instanceof fabric.Circle).map(circle => ({ x: circle.left, y: circle.top }));
    const polygon = new fabric.Polygon(points, {
        fill: 'rgba(0, 255, 0, 0.3)',
        selectable: false
    });
    canvas.add(polygon);

    currentShape = [];
}

function applyTransform() {
    console.log("Sending points for transformation:", points);
    fetch('/transform', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ points: points }),
    })
        .then(response => response.json())
        .then(data => {
            console.log("Transformation complete. Updating image.");
            fabric.Image.fromURL('/static/transformed.png?t=' + new Date().getTime(), function (img) {
                canvas.clear();
                canvas.setWidth(data.width);
                canvas.setHeight(data.height);
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                    scaleX: canvas.width / img.width,
                    scaleY: canvas.height / img.height
                });

                adjustLayout();
            });
            mode = 'draw';
            points = [];  // Clear the points after transformation
            document.getElementById('transformBtn').style.display = 'none';
            document.getElementById('processBtn').style.display = 'inline';
            updateInstructions();
        });
}


function processImage() {
    const shapes = canvas.getObjects('polygon').map(polygon =>
        polygon.points.map(point => [point.x, point.y])
    );
    fetch('/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shapes: shapes }),
    })
        .then(response => response.text())
        .then(data => {
            document.getElementById('downloadBtn').style.display = 'inline';
            document.getElementById('downloadBtn').href = '/download';
        });
}

function resetCanvas() {
    // Clear the canvas
    canvas.clear();

    // Reinitialize the canvas with the original image
    initializeCanvas();

    // Reset variables
    points = [];
    mode = 'select';
    currentShape = [];

    // Reset button visibility
    document.getElementById('transformBtn').style.display = 'none';
    document.getElementById('processBtn').style.display = 'none';
    document.getElementById('downloadBtn').style.display = 'none';

    // Update instructions
    updateInstructions();

    // Reattach event listeners
    attachEventListeners();
}
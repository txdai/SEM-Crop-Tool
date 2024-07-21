from flask import Flask, render_template, request, send_file, send_from_directory, jsonify, redirect, url_for
import cv2
import numpy as np
from PIL import Image
import io
import os
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "tif", "tiff"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        file = request.files["file"]
        if file and allowed_file(file.filename):
            image = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_UNCHANGED)
            cv2.imwrite("static/original.png", image)
            return render_template("edit.html")
    return render_template("index.html")


@app.route("/edit")
def edit():
    return render_template("edit.html")


@app.route("/back")
def back():
    if os.path.exists("static/original.png"):
        os.remove("static/original.png")
    return redirect(url_for("index"))


@app.route("/transform", methods=["POST"])
def transform():
    data = request.json
    points = data.get("points")

    if not points or len(points) != 4:
        return jsonify({"error": "Invalid points data"}), 400

    app.logger.debug(f"Received points: {points}")

    img = cv2.imread("static/original.png")
    if img is None:
        return jsonify({"error": "Failed to read original image"}), 500

    img_height, img_width = img.shape[:2]
    app.logger.debug(f"Original image size: {img_width}x{img_height}")

    src_pts = np.float32([[p["x"], p["y"]] for p in points])

    # Calculate the side length of the square (maximum of the width and height of the bounding box)
    width = max(np.linalg.norm(src_pts[0] - src_pts[1]), np.linalg.norm(src_pts[2] - src_pts[3]))
    height = max(np.linalg.norm(src_pts[0] - src_pts[3]), np.linalg.norm(src_pts[1] - src_pts[2]))
    square_side = max(width, height)

    # Define the destination points as a perfect square
    dst_pts = np.float32([[0, 0], [square_side - 1, 0], [square_side - 1, square_side - 1], [0, square_side - 1]])

    # Increase the resolution of the output square
    output_size = 800
    scale_factor = output_size / square_side
    dst_pts *= scale_factor

    # Get the perspective transform matrix
    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)

    # Apply the perspective transformation with increased resolution
    result = cv2.warpPerspective(img, matrix, (output_size, output_size))

    cv2.imwrite("static/transformed.png", result)

    final_size = result.shape[:2]
    app.logger.debug(f"Transformed image size: {final_size[1]}x{final_size[0]}")

    return jsonify({"message": "Transform successful", "width": final_size[1], "height": final_size[0]}), 200


@app.route("/process", methods=["POST"])
def process():
    shapes = request.json["shapes"]
    img = cv2.imread("static/transformed.png")
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    for shape in shapes:
        points = np.array(shape, dtype=np.int32)
        cv2.fillPoly(mask, [points], 255)
    result = cv2.bitwise_and(img, img, mask=mask)
    gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
    cv2.imwrite("static/result.png", binary)
    return jsonify({"message": "Processing successful"}), 200


@app.route("/download")
def download():
    return send_file("static/result.png", as_attachment=True)


@app.route("/static/<path:path>")
def send_static(path):
    return send_from_directory("static", path)


if __name__ == "__main__":
    app.run(debug=True)

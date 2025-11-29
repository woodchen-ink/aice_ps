/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Helper to load an image from a URL
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Important for canvas with data URLs
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
        img.src = src;
    });
}

// Function to generate a random number within a range
function rand(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

export const createAlbumPage = async (
    generatedImages: Record<string, { url?: string }>,
    decades: string[]
): Promise<string> => {
    const CANVAS_WIDTH = 2400;
    const CANVAS_HEIGHT = 3000;
    const PADDING = 150;

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error("Could not create canvas context");
    }

    // Background
    ctx.fillStyle = '#fdf5e6'; // Off-white, like an album page
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Title
    ctx.fillStyle = '#333';
    ctx.font = `bold 160px "Caveat"`;
    ctx.textAlign = 'center';
    ctx.fillText("Past Forward", CANVAS_WIDTH / 2, PADDING + 40);

    // Load all images concurrently
    const imageElements = await Promise.all(
        decades.map(decade => {
            const imgData = generatedImages[decade];
            return imgData?.url ? loadImage(imgData.url) : Promise.resolve(null);
        })
    );

    // Define layout grid
    const cols = 2;
    const rows = 3;
    const gridWidth = CANVAS_WIDTH - PADDING * 2;
    const gridHeight = CANVAS_HEIGHT - PADDING * 2 - 200; //-200 for title
    const cellWidth = gridWidth / cols;
    const cellHeight = gridHeight / rows;

    // Polaroid dimensions
    const polaroidWidth = cellWidth * 0.8;
    const polaroidHeight = polaroidWidth * 1.2;
    const maxImageWidth = polaroidWidth * 0.9;
    const maxImageHeight = polaroidHeight * 0.6; // Reserve space for title at bottom

    for (let i = 0; i < decades.length; i++) {
        const img = imageElements[i];
        const decade = decades[i];
        if (!img) continue;

        const row = Math.floor(i / cols);
        const col = i % cols;

        const cellX = PADDING + col * cellWidth;
        const cellY = PADDING + 200 + row * cellHeight;
        
        // Center polaroid in the cell with some randomness
        const centerX = cellX + cellWidth / 2;
        const centerY = cellY + cellHeight / 2;
        
        ctx.save();
        
        // Translate and rotate
        ctx.translate(centerX, centerY);
        ctx.rotate(rand(-0.1, 0.1)); // Random rotation between ~ -5 and +5 degrees

        // Draw shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 10;
        
        // Draw polaroid frame
        ctx.fillStyle = 'white';
        ctx.fillRect(-polaroidWidth / 2, -polaroidHeight / 2, polaroidWidth, polaroidHeight);
        
        // Reset shadow for subsequent drawings
        ctx.shadowColor = 'transparent';

        // Calculate image dimensions while maintaining aspect ratio
        const imgAspectRatio = img.naturalWidth / img.naturalHeight;
        let imageWidth = maxImageWidth;
        let imageHeight = imageWidth / imgAspectRatio;

        // If height exceeds max, scale down by height instead
        if (imageHeight > maxImageHeight) {
            imageHeight = maxImageHeight;
            imageWidth = imageHeight * imgAspectRatio;
        }

        // Draw the image centered in the polaroid
        const imageX = -imageWidth / 2;
        const imageY = -polaroidHeight / 2 + (polaroidWidth - imageWidth) / 2;
        ctx.drawImage(img, imageX, imageY, imageWidth, imageHeight);
        
        // Draw the text
        ctx.fillStyle = '#222';
        ctx.font = `80px "Permanent Marker"`;
        ctx.textAlign = 'center';
        const textY = polaroidHeight / 2 - 50;
        ctx.fillText(decade, 0, textY);
        
        ctx.restore();
    }

    return canvas.toDataURL('image/jpeg', 0.9);
};
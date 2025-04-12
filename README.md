# Mesh

A collaborative pixel canvas application inspired by Reddit's r/place. Mesh allows users to place individual pixels on a shared canvas, creating community artwork one pixel at a time.

## Overview

Mesh is a real-time collaborative drawing platform built with Next.js and Firebase. Users can place colored pixels on a shared canvas with a one-minute cooldown between placements. The application features authentication, real-time updates, customizable color palettes, and pixel placement history tracking.

## Live Application

The application is deployed and fully functional at: [https://mesh-canvas.vercel.app](https://pixel-mesh.vercel.app)

## Technical Stack

- **Frontend**: Next.js, React
- **Backend**: Firebase (Authentication, Firestore)
- **State Management**: React Hooks
- **UI Components**: Custom styling with CSS-in-JS
- **Deployment**: Vercel

## Features

- **User Authentication**: Secure login and account management
- **Real-time Canvas Updates**: See changes from other users instantly
- **Customizable Color Palette**: Create and save your own color set
- **Interactive Canvas Controls**:
  - Pan by dragging
  - Zoom in/out with scroll wheel
  - Click to place pixels
- **Pixel History**: Hover over pixels to see who placed them and when
- **Cooldown Timer**: 60-second cooldown between pixel placements
- **Responsive Design**: Works across various screen sizes

## Usage

1. Visit the live application
2. Register for an account or login
3. Select a color from the palette or create custom colors
4. Click on the canvas to place a pixel
5. Wait for the cooldown timer to place another pixel
6. Drag to pan around the canvas and use the mouse wheel to zoom

## Implementation Details

Mesh implements a distributed canvas system with pixel-level ownership tracking:

- Real-time updates powered by Firestore listeners
- Custom zoom and pan implementation
- Optimized rendering for large-scale collaborative art
- User-specific customizable color palettes saved in Firestore
- Cooldown system to prevent spam and encourage thoughtful placement

## Screenshots

![image](https://github.com/user-attachments/assets/e5fe84cc-b444-410e-bc97-21e950ff372e)

![image](https://github.com/user-attachments/assets/3360740b-6f57-4d4d-99a8-260a9a6b8e06)

## Development

This project is built with Next.js and Firebase. The main canvas implementation can be found in the `canvas/page.js` file, featuring a custom rendering system optimized for collaborative pixel art.

## Acknowledgements

- Inspired by Reddit's r/place
- Built with Next.js and Firebase

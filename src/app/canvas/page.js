// canvas/page.js
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { SketchPicker } from "react-color";
import { logout } from "../firebase";

export default function CanvasPage() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [hoverInfo, setHoverInfo] = useState(null);

  // Define theme similar to login page
  const theme = {
    background: "#16202A",
    inputBg: "#16202A",
    borderColor: "#92B4F4",
    buttonBg: "#669BBC",
    textColor: "#F1F5F9",
  };

  const defaultColors = ["#92B4F4", "#8CD3C5", "#669BBC", "#FFFFFF", "#16202A"];
  const [customColors, setCustomColors] = useState(defaultColors);
  const [selectedColor, setSelectedColor] = useState(defaultColors[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState(null);
  const [canPlace, setCanPlace] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [gridData, setGridData] = useState({});
  const [gridMetadata, setGridMetadata] = useState({});
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [totalPlaced, setTotalPlaced] = useState(0);
  const [lastCellClicked, setLastCellClicked] = useState(null);

  const canvasRef = useRef(null);
  const colorPaletteRef = useRef(null);
  const gridContainerRef = useRef(null);
  const router = useRouter();
  const auth = getAuth();
  const firestore = getFirestore();

  const GRID_SIZE = 10; // Size of each cell in pixels at zoom level 1
  const GRID_WIDTH = 200; // Number of cells in width
  const GRID_HEIGHT = 100; // Number of cells in height
  const COOLDOWN_TIME = 60; // Time in seconds before user can place another pixel

  // Check authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);

      if (currentUser) {
        setUser(currentUser);

        // Get user data
        try {
          const userDoc = await getDoc(
            doc(firestore, "users", currentUser.uid)
          );
          const userData = userDoc.data();

          if (userData) {
            setUsername(userData.username || currentUser.email.split("@")[0]);
            setTotalPlaced(userData.totalPlaced || 0);

            // Load saved custom colors if available
            if (userData.customColors && Array.isArray(userData.customColors)) {
              setCustomColors(userData.customColors);
            }

            // Check if user can place a pixel
            if (userData.placeTimer) {
              const placeTime = userData.placeTimer.toDate();
              const now = new Date();
              const remainingTime = Math.ceil((placeTime - now) / 1000);

              if (remainingTime <= 0) {
                setCanPlace(true);
              } else {
                setCanPlace(false);
                setTimeRemaining(remainingTime);

                // Start countdown
                const timerInterval = setInterval(() => {
                  setTimeRemaining((prev) => {
                    if (prev <= 1) {
                      clearInterval(timerInterval);
                      setCanPlace(true);
                      return 0;
                    }
                    return prev - 1;
                  });
                }, 1000);

                return () => clearInterval(timerInterval);
              }
            } else {
              setCanPlace(true);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }

        setLoading(false);
      } else {
        // Redirect to login if not authenticated
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [auth, router, firestore]);

  // Save custom colors to user profile
  useEffect(() => {
    const saveCustomColors = async () => {
      if (user && customColors.length > 0) {
        try {
          await updateDoc(doc(firestore, "users", user.uid), {
            customColors: customColors,
          });
        } catch (error) {
          console.error("Error saving custom colors:", error);
        }
      }
    };

    // Debounce to avoid too many writes
    const timeoutId = setTimeout(saveCustomColors, 2000);
    return () => clearTimeout(timeoutId);
  }, [customColors, user, firestore]);

  // Add horizontal scrolling to color palette
  useEffect(() => {
    const paletteEl = colorPaletteRef.current;
    if (!paletteEl) return;

    const handleWheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        paletteEl.scrollLeft += e.deltaY;
      }
    };

    paletteEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => paletteEl.removeEventListener("wheel", handleWheel);
  }, []);

  // Fetch grid data with real-time updates
  useEffect(() => {
    if (!firestore) return;

    // Create grid document if it doesn't exist
    const initializeGrid = async () => {
      const gridDocRef = doc(firestore, "canvas", "grid");
      const gridDoc = await getDoc(gridDocRef);

      if (!gridDoc.exists()) {
        await setDoc(gridDocRef, {
          cells: {},
          metadata: {},
        });
      }
    };

    initializeGrid();

    // Set up real-time listener for grid updates
    const unsubscribe = onSnapshot(
      doc(firestore, "canvas", "grid"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setGridData(data.cells || {});
          setGridMetadata(data.metadata || {});
        } else {
          setGridData({});
          setGridMetadata({});
        }
      },
      (error) => {
        console.error("Error getting grid updates:", error);
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const totalWidth = GRID_WIDTH * GRID_SIZE * zoom;
    const totalHeight = GRID_HEIGHT * GRID_SIZE * zoom;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    // Clear canvas
    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw filled cells first
    Object.entries(gridData).forEach(([key, color]) => {
      const [x, y] = key.split(",").map(Number);
      ctx.fillStyle = color;
      ctx.fillRect(
        x * GRID_SIZE * zoom,
        y * GRID_SIZE * zoom,
        GRID_SIZE * zoom,
        GRID_SIZE * zoom
      );
    });

    // Draw grid lines
    ctx.strokeStyle = "#92B4F4";
    ctx.lineWidth = 0.5 * zoom;

    // Draw vertical lines
    for (let x = 0; x <= GRID_WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(x * GRID_SIZE * zoom, 0);
      ctx.lineTo(x * GRID_SIZE * zoom, totalHeight);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * GRID_SIZE * zoom);
      ctx.lineTo(totalWidth, y * GRID_SIZE * zoom);
      ctx.stroke();
    }
  }, [gridData, zoom]);

  // Handle mouse down for dragging
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      // Left click
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      setHoverInfo(null);
    } else {
      // If not dragging, check for hover info
      const coordinates = calculateGridCoordinates(e);
      if (coordinates) {
        const { x, y } = coordinates;
        const cellKey = `${x},${y}`;

        if (gridData[cellKey]) {
          const color = gridData[cellKey];
          const metadata = gridMetadata[cellKey];

          // Convert hex to RGB
          const hex = color.replace("#", "");
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);

          setHoverInfo({
            x: e.clientX,
            y: e.clientY,
            color,
            rgb: `RGB: ${r}, ${g}, ${b}`,
            username: metadata?.username || "Unknown",
            timestamp: metadata?.timestamp
              ? new Date(metadata.timestamp.seconds * 1000).toLocaleString()
              : "Unknown time",
          });
        } else {
          setHoverInfo(null);
        }
      } else {
        setHoverInfo(null);
      }
    }
  };

  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle zoom with wheel
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.5), 5);
    setZoom(newZoom);
  };

  // Handle color change from the color picker
  const handleColorChange = (color) => {
    const newColor = color.hex;

    if (editingColorIndex !== null) {
      // Update an existing color
      const updatedColors = [...customColors];
      updatedColors[editingColorIndex] = newColor;
      setCustomColors(updatedColors);
      setSelectedColor(newColor);
    }
  };

  // Add a new color to the palette
  const addNewColor = () => {
    // Default to a random color
    const randomColor = `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`;
    const newColors = [...customColors, randomColor];
    setCustomColors(newColors);
    setSelectedColor(randomColor);
    setEditingColorIndex(newColors.length - 1);
    setShowColorPicker(true);

    // Scroll to the end of the palette
    setTimeout(() => {
      if (colorPaletteRef.current) {
        colorPaletteRef.current.scrollLeft =
          colorPaletteRef.current.scrollWidth;
      }
    }, 10);
  };

  // Handle clicking on a color in the palette
  const handleColorClick = (color, index) => {
    setSelectedColor(color);
    setEditingColorIndex(index);
    setShowColorPicker(true);
  };

  // Calculate grid coordinates from click event
  const calculateGridCoordinates = (e) => {
    if (!canvasRef.current) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (GRID_SIZE * zoom));
    const y = Math.floor((e.clientY - rect.top) / (GRID_SIZE * zoom));

    // Ensure coordinates are within the grid
    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
      return { x, y };
    }
    return null;
  };

  // Handle cell click to place color
  const handleCanvasClick = async (e) => {
    // Prevent handling click if we're dragging
    if (isDragging) return;

    const coordinates = calculateGridCoordinates(e);
    if (!coordinates) return;

    const { x, y } = coordinates;
    const cellKey = `${x},${y}`;
    setLastCellClicked(cellKey);

    // Check if user can place a pixel
    if (!canPlace || !user) {
      console.log("Cannot place pixel now");
      return;
    }

    try {
      // Update grid in Firestore
      const gridRef = doc(firestore, "canvas", "grid");
      const now = new Date();

      await updateDoc(gridRef, {
        [`cells.${cellKey}`]: selectedColor,
        [`metadata.${cellKey}`]: {
          userId: user.uid,
          username: username,
          timestamp: Timestamp.fromDate(now),
        },
      });

      // Update user data with cooldown
      const userRef = doc(firestore, "users", user.uid);
      const oneMinuteLater = new Date();
      oneMinuteLater.setMinutes(oneMinuteLater.getMinutes() + 1);

      await updateDoc(userRef, {
        placeTimer: Timestamp.fromDate(oneMinuteLater),
        totalPlaced: totalPlaced + 1,
      });

      // Update local state
      setTotalPlaced((prev) => prev + 1);
      setCanPlace(false);
      setTimeRemaining(COOLDOWN_TIME);

      // Start countdown
      const timerInterval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            setCanPlace(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Error placing pixel:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Format remaining time as MM:SS
  const formatTimeRemaining = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  // Toggle custom color picker
  const closeColorPicker = () => {
    setShowColorPicker(false);
    setEditingColorIndex(null);
  };

  // If still loading or user not authenticated, show loading screen or redirect
  if (loading) {
    return (
      <div style={styles.loadingContainer(theme)}>
        <p>Loading canvas...</p>
      </div>
    );
  }

  if (!user) {
    // This is a safeguard, the useEffect should already redirect
    return null;
  }

  return (
    <div style={styles.pageStyle(theme)}>
      <div style={styles.header(theme)}>
        <h1 style={styles.title(theme)}>Mesh.</h1>
        <div style={styles.userInfo}>
          <span style={styles.username(theme)}>@{username}</span>
          <span style={styles.userStat(theme)}>
            Total Placed: {totalPlaced}
          </span>
          <span style={styles.userStat(theme)}>
            {canPlace
              ? "Ready to place"
              : `Next pixel in: ${formatTimeRemaining(timeRemaining)}`}
          </span>
          <button onClick={handleLogout} style={styles.logoutButton(theme)}>
            Logout
          </button>
        </div>
      </div>

      <div ref={colorPaletteRef} style={styles.colorPickerContainer(theme)}>
        <div style={styles.colorPicker(theme)}>
          {customColors.map((color, index) => (
            <div
              key={`${color}-${index}`}
              style={{
                ...styles.colorOption(theme),
                backgroundColor: color,
                transform: selectedColor === color ? "scale(1.2)" : "scale(1)",
              }}
              onClick={() => handleColorClick(color, index)}
            />
          ))}
          <div style={styles.addColorButton(theme)} onClick={addNewColor}>
            <span style={styles.customColorText}>+</span>
          </div>
        </div>
      </div>

      {showColorPicker && (
        <div style={styles.popover}>
          <div style={styles.cover} onClick={closeColorPicker} />
          <div style={styles.colorPickerWrapper}>
            <SketchPicker
              color={
                editingColorIndex !== null
                  ? customColors[editingColorIndex]
                  : selectedColor
              }
              onChange={handleColorChange}
              disableAlpha={true}
            />
            <div style={styles.pickerActions}>
              <button
                onClick={closeColorPicker}
                style={styles.pickerButton(theme)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={gridContainerRef}
        style={styles.canvasContainer}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}>
        <div
          style={{
            ...styles.canvasWrapper,
            transform: `translate(${position.x}px, ${position.y}px)`,
            cursor: isDragging
              ? "grabbing"
              : canPlace
              ? "pointer"
              : "not-allowed",
          }}>
          <canvas ref={canvasRef} style={styles.canvas} />
        </div>

        {/* Hover tooltip */}
        {hoverInfo && (
          <div
            style={{
              ...styles.hoverTooltip(theme),
              top: hoverInfo.y + 20,
              left: hoverInfo.x + 10,
            }}>
            <div
              style={{
                ...styles.colorPreview,
                backgroundColor: hoverInfo.color,
              }}
            />
            <div style={styles.tooltipInfo}>
              <p style={styles.tooltipText}>Placed by: {hoverInfo.username}</p>
              <p style={styles.tooltipText}>Time: {hoverInfo.timestamp}</p>
              <p style={styles.tooltipText}>
                {hoverInfo.color} ({hoverInfo.rgb})
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={styles.instructions(theme)}>
        <p>• Drag to pan • Scroll to zoom • Click to place •</p>
      </div>
    </div>
  );
}

const styles = {
  pageStyle: (theme) => ({
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100vw",
    backgroundColor: theme.background,
    color: theme.textColor,
    fontFamily: "monospace",
    overflow: "hidden",
  }),
  loadingContainer: (theme) => ({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    width: "100vw",
    backgroundColor: theme.background,
    color: theme.textColor,
    fontFamily: "monospace",
  }),
  header: (theme) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 2rem",
    backgroundColor: theme.inputBg,
    borderBottom: `1px solid ${theme.borderColor}`,
    zIndex: 10,
  }),
  title: (theme) => ({
    margin: 0,
    color: theme.textColor,
    fontFamily: "monospace",
    fontWeight: "500",
    fontSize: "2rem",
  }),
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
  },
  username: (theme) => ({
    color: theme.borderColor,
    fontWeight: "bold",
    fontSize: "0.9rem",
  }),
  userStat: (theme) => ({
    color: theme.textColor,
    fontSize: "0.9rem",
  }),
  logoutButton: (theme) => ({
    backgroundColor: theme.buttonBg,
    color: theme.textColor,
    border: `1px solid ${theme.borderColor}`,
    padding: "0.5rem 1rem",
    cursor: "pointer",
    fontSize: "0.9rem",
    borderRadius: "0",
    fontFamily: "'Jersey 15', sans-serif",
  }),
  colorPickerContainer: (theme) => ({
    backgroundColor: theme.inputBg,
    borderBottom: `1px solid ${theme.borderColor}`,
    padding: "0.5rem",
    overflowX: "auto",
    overflowY: "hidden",
    whiteSpace: "nowrap",
    zIndex: 10,
    msOverflowStyle: "none", // IE and Edge
    scrollbarWidth: "none", // Firefox
    "&::-webkit-scrollbar": {
      display: "none", // Chrome, Safari, Opera
    },
  }),
  colorPicker: (theme) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "1rem",
    padding: "0 1rem",
    minWidth: "100%",
  }),
  colorOption: (theme) => ({
    width: "2rem",
    height: "2rem",
    borderRadius: "0",
    cursor: "pointer",
    transition: "transform 0.2s ease",
    boxShadow: `0 0 0 1px ${theme.borderColor}`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  }),
  addColorButton: (theme) => ({
    width: "2rem",
    height: "2rem",
    borderRadius: "0",
    cursor: "pointer",
    backgroundColor: "#F1F5F9",
    boxShadow: `0 0 0 1px ${theme.borderColor}`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  }),
  customColorText: {
    fontSize: "1.5rem",
    fontWeight: "bold",
    color: "#16202A",
    userSelect: "none",
  },
  popover: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 30,
  },
  cover: {
    position: "fixed",
    top: "0",
    right: "0",
    bottom: "0",
    left: "0",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 20,
  },
  colorPickerWrapper: {
    position: "relative",
    zIndex: 30,
    backgroundColor: "#fff",
    borderRadius: "4px",
    boxShadow: "0 0 10px rgba(0, 0, 0, 0.3)",
    padding: "1rem",
  },
  pickerActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "1rem",
  },
  pickerButton: (theme) => ({
    backgroundColor: theme.buttonBg,
    color: theme.textColor,
    border: `1px solid ${theme.borderColor}`,
    padding: "0.5rem 1rem",
    cursor: "pointer",
    fontSize: "0.9rem",
    borderRadius: "4px",
  }),
  canvasContainer: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  canvasWrapper: {
    position: "absolute",
    transition: "transform 0.05s ease-out",
  },
  canvas: {
    imageRendering: "pixelated",
  },
  hoverTooltip: (theme) => ({
    position: "fixed",
    backgroundColor: theme.inputBg,
    border: `1px solid ${theme.borderColor}`,
    padding: "0.5rem",
    borderRadius: "4px",
    boxShadow: "0 0 10px rgba(0, 0, 0, 0.3)",
    zIndex: 15,
    minWidth: "200px",
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
  }),
  colorPreview: {
    width: "2rem",
    height: "2rem",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    flexShrink: 0,
  },
  tooltipInfo: {
    flex: 1,
  },
  tooltipText: {
    margin: "0.25rem 0",
    fontSize: "0.8rem",
  },
  instructions: (theme) => ({
    padding: "0.5rem",
    backgroundColor: theme.inputBg,
    borderTop: `1px solid ${theme.borderColor}`,
    textAlign: "center",
    fontSize: "0.8rem",
    color: theme.textColor,
  }),
};

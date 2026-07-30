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
import { Pen } from "lucide-react";

export default function CanvasPage() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStarted, setTouchStarted] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [drawMode, setDrawMode] = useState(true);

  // Define theme similar to login page
  const theme = {
    background: "#16202A",
    inputBg: "#16202A",
    borderColor: "#92B4F4",
    buttonBg: "#669BBC",
    textColor: "#F1F5F9",
  };

  // Exactly 10 default colors – the palette is now fixed to 10 slots
  const defaultColors = [
    "#92B4F4", "#8CD3C5", "#669BBC", "#FFFFFF", "#16202A",
    "#FF6B6B", "#FECA57", "#48DBFB", "#FF9FF3", "#54A0FF",
  ];

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
  const userMenuRef = useRef(null);
  const router = useRouter();
  const auth = getAuth();
  const firestore = getFirestore();

  const GRID_SIZE = 10;
  const GRID_WIDTH = 200;
  const GRID_HEIGHT = 100;
  const COOLDOWN_TIME = 60;

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        showUserMenu &&
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showUserMenu]);

  // Check authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);

      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(
            doc(firestore, "users", currentUser.uid)
          );
          const userData = userDoc.data();

          if (userData) {
            setUsername(userData.username || currentUser.email.split("@")[0]);
            setTotalPlaced(userData.totalPlaced || 0);

            // Load saved custom colors; ensure array is always exactly 10 elements
            let savedColors = userData.customColors;
            if (Array.isArray(savedColors) && savedColors.length === 10) {
              setCustomColors(savedColors);
            } else {
              // If saved colors are missing or not exactly 10, use defaults
              setCustomColors(defaultColors);
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
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [auth, router, firestore]);

  // Save custom colors to user profile (debounced)
  useEffect(() => {
    const saveCustomColors = async () => {
      if (user && customColors.length === 10) {
        try {
          await updateDoc(doc(firestore, "users", user.uid), {
            customColors: customColors,
          });
        } catch (error) {
          console.error("Error saving custom colors:", error);
        }
      }
    };
    const timeoutId = setTimeout(saveCustomColors, 2000);
    return () => clearTimeout(timeoutId);
  }, [customColors, user, firestore]);

  // Horizontal scrolling for color palette
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

    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    ctx.strokeStyle = "#92B4F4";
    ctx.lineWidth = 0.5 * zoom;
    for (let x = 0; x <= GRID_WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(x * GRID_SIZE * zoom, 0);
      ctx.lineTo(x * GRID_SIZE * zoom, totalHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * GRID_SIZE * zoom);
      ctx.lineTo(totalWidth, y * GRID_SIZE * zoom);
      ctx.stroke();
    }
  }, [gridData, zoom]);

  // Touch event handlers for mobile
  const handleTouchStart = (e) => {
    e.preventDefault();
    setTouchStarted(true);
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDistance(dist);
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!touchStarted) return;
    if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
      setHoverInfo(null);
    } else if (e.touches.length === 2 && lastTouchDistance !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = newDist / lastTouchDistance;
      const newZoom = Math.min(Math.max(zoom * ratio, 0.5), 5);
      setZoom(newZoom);
      setLastTouchDistance(newDist);
    }
  };

  const handleTouchEnd = (e) => {
    if (isDragging && touchStarted && !e.touches.length) {
      const moveThreshold = 10;
      const moveX = Math.abs(
        position.x - (dragStart.x - e.changedTouches[0].clientX)
      );
      const moveY = Math.abs(
        position.y - (dragStart.y - e.changedTouches[0].clientY)
      );
      if (moveX < moveThreshold && moveY < moveThreshold && drawMode) {
        handleCanvasTap(e.changedTouches[0]);
      }
    }
    setIsDragging(false);
    setTouchStarted(false);
    setLastTouchDistance(null);
  };

  const handleCanvasTap = (touch) => {
    if (!canvasRef.current || !drawMode) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((touch.clientX - rect.left) / (GRID_SIZE * zoom));
    const y = Math.floor((touch.clientY - rect.top) / (GRID_SIZE * zoom));
    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
      const cellKey = `${x},${y}`;
      setLastCellClicked(cellKey);
      if (!canPlace || !user) return;
      placeTile(x, y);
    }
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      setHoverInfo(null);
    } else {
      const coordinates = calculateGridCoordinates(e);
      if (coordinates) {
        const { x, y } = coordinates;
        const cellKey = `${x},${y}`;
        if (gridData[cellKey]) {
          const color = gridData[cellKey];
          const metadata = gridMetadata[cellKey];
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.5), 5);
    setZoom(newZoom);
  };

  // Color picker logic – now only editing existing slots
  const handleColorChange = (color) => {
    if (editingColorIndex !== null) {
      const updatedColors = [...customColors];
      updatedColors[editingColorIndex] = color.hex;
      setCustomColors(updatedColors);
      setSelectedColor(color.hex);
    }
  };

  const handleColorClick = (color, index) => {
    setSelectedColor(color);
    setEditingColorIndex(index);
    setShowColorPicker(true);
  };

  const calculateGridCoordinates = (e) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (GRID_SIZE * zoom));
    const y = Math.floor((e.clientY - rect.top) / (GRID_SIZE * zoom));
    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
      return { x, y };
    }
    return null;
  };

  const placeTile = async (x, y) => {
    const cellKey = `${x},${y}`;
    try {
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
      const userRef = doc(firestore, "users", user.uid);
      const twentySecondsLater = new Date(now.getTime() + 20 * 1000);
      await updateDoc(userRef, {
        placeTimer: Timestamp.fromDate(twentySecondsLater),
        totalPlaced: totalPlaced + 1,
      });
      setTotalPlaced((prev) => prev + 1);
      setCanPlace(false);
      setTimeRemaining(20);
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

  const handleCanvasClick = async (e) => {
    if (isDragging || !drawMode) return;
    const coordinates = calculateGridCoordinates(e);
    if (!coordinates) return;
    const { x, y } = coordinates;
    const cellKey = `${x},${y}`;
    setLastCellClicked(cellKey);
    if (!canPlace || !user) return;
    placeTile(x, y);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const formatTimeRemaining = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const closeColorPicker = () => {
    setShowColorPicker(false);
    setEditingColorIndex(null);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  const toggleDrawMode = () => {
    setDrawMode(!drawMode);
  };

  const handleResetView = () => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer(theme)}>
        <p>Loading canvas...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={styles.pageStyle(theme, isMobile)}>
      {/* Header */}
      <div style={styles.header(theme, isMobile)}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: "2vh",
          }}>
          <div
            style={{
              height: isMobile ? "4vh" : "5vh",
              width: isMobile ? "4vh" : "5vh",
              backgroundRepeat: "no-repeat",
              backgroundImage: `url("/logo.png")`,
              backgroundSize: "contain",
            }}></div>
          <h1 style={styles.title(theme, isMobile)}>Mesh.</h1>
        </div>

        {isMobile ? (
          <div style={styles.userInfo(isMobile)}>
            <div style={styles.usernameWrapper}>
              <span style={styles.username(theme)} onClick={toggleUserMenu}>
                @{username}
              </span>

              {showUserMenu && (
                <div ref={userMenuRef} style={styles.userDropdown(theme)}>
                  <div style={styles.dropdownItem}>
                    <span>Total Placed: {totalPlaced}</span>
                  </div>
                  <div style={styles.dropdownItem}>
                    <span>
                      {canPlace
                        ? "Ready to place"
                        : `Next pixel: ${formatTimeRemaining(timeRemaining)}`}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={styles.logoutButton(theme, isMobile)}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.userInfo(isMobile)}>
            <span style={styles.username(theme)}>@{username}</span>
            <span style={styles.userStat(theme)}>
              Total Placed: {totalPlaced}
            </span>
            <span style={styles.userStat(theme)}>
              {canPlace
                ? "Ready to place"
                : `Next pixel in: ${formatTimeRemaining(timeRemaining)}`}
            </span>
            <button
              onClick={handleLogout}
              style={styles.logoutButton(theme, isMobile)}>
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Color tools – "+" button removed, palette fixed to 10 slots */}
      <div
        ref={colorPaletteRef}
        className="color-picker-container"
        style={styles.colorPickerContainer(theme, isMobile)}>
        <div
          style={{
            ...styles.drawModeButton(theme),
            backgroundColor: drawMode ? theme.buttonBg : theme.inputBg,
          }}
          onClick={toggleDrawMode}>
          <Pen size={18} color={theme.textColor} />
        </div>

        <div style={styles.colorPicker(theme, isMobile)}>
          {customColors.map((color, index) => (
            <div
              key={`${color}-${index}`}
              style={{
                ...styles.colorOption(theme, isMobile),
                backgroundColor: color,
                transform: selectedColor === color ? "scale(1.2)" : "scale(1)",
              }}
              onClick={() => handleColorClick(color, index)}
            />
          ))}
          {/* Add color button removed */}
        </div>
      </div>

      {showColorPicker && (
        <div style={styles.popover}>
          <div style={styles.cover} onClick={closeColorPicker} />
          <div style={styles.colorPickerWrapper(isMobile)}>
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

      {/* Canvas */}
      <div
        ref={gridContainerRef}
        style={styles.canvasContainer}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        onTouchCancel={isMobile ? handleTouchEnd : undefined}>
        <div
          style={{
            ...styles.canvasWrapper,
            transform: `translate(${position.x}px, ${position.y}px)`,
            cursor: isDragging
              ? "grabbing"
              : canPlace && drawMode
              ? "pointer"
              : "not-allowed",
          }}>
          <canvas ref={canvasRef} style={styles.canvas} />
        </div>

        {hoverInfo && !isMobile && (
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

        {isMobile && (
          <div style={styles.mobileControls(theme)}>
            <button
              style={styles.mobileControlButton(theme)}
              onClick={handleResetView}>
              Reset View
            </button>
          </div>
        )}
      </div>

      <div style={styles.instructions(theme, isMobile)}>
        {isMobile ? (
          <p style={styles.instructionText(isMobile)}>
            Drag to move • Pinch to zoom • Tap to place
          </p>
        ) : (
          <p>Drag to pan • Scroll to zoom • Click to place</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageStyle: (theme, isMobile) => ({
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100vw",
    backgroundColor: theme.background,
    color: theme.textColor,
    fontFamily: "monospace",
    overflow: "hidden",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    touchAction: isMobile ? "none" : "auto",
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
  header: (theme, isMobile) => ({
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: isMobile ? "0.5rem 1rem" : "1rem 2rem",
    backgroundColor: theme.inputBg,
    borderBottom: `1px solid ${theme.borderColor}`,
    zIndex: 20,
    minHeight: isMobile ? "40px" : "auto",
  }),
  title: (theme, isMobile) => ({
    margin: 0,
    color: theme.textColor,
    fontFamily: "monospace",
    fontWeight: "500",
    fontSize: isMobile ? "1.2rem" : "2rem",
  }),
  userInfo: (isMobile) => ({
    display: "flex",
    flexDirection: isMobile ? "row" : "row",
    alignItems: "center",
    gap: isMobile ? "0.5rem" : "1.5rem",
    position: isMobile ? "relative" : "static",
  }),
  usernameWrapper: {
    position: "relative",
  },
  username: (theme) => ({
    color: theme.borderColor,
    fontWeight: "bold",
    fontSize: "0.9rem",
    cursor: "pointer",
    zIndex: 200,
  }),
  userStat: (theme) => ({
    color: theme.textColor,
    fontSize: "0.9rem",
  }),
  userDropdown: (theme) => ({
    position: "absolute",
    top: "120%",
    right: 0,
    backgroundColor: theme.inputBg,
    border: `1px solid ${theme.borderColor}`,
    zIndex: 1000,
    width: "180px",
    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
  }),
  dropdownItem: {
    padding: "0.7rem",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    fontSize: "0.8rem",
  },
  logoutButton: (theme, isMobile) => ({
    backgroundColor: theme.buttonBg,
    color: theme.textColor,
    border: `1px solid ${theme.borderColor}`,
    padding: "0.5rem 1rem",
    cursor: "pointer",
    fontSize: "0.9rem",
    borderRadius: "0",
    fontFamily: "'Jersey 15', sans-serif",
    marginTop: isMobile ? "0.5rem" : 0,
    alignSelf: isMobile ? "flex-start" : "auto",
  }),
  colorPickerContainer: (theme, isMobile) => ({
    display: "flex",
    backgroundColor: theme.inputBg,
    borderBottom: `1px solid ${theme.borderColor}`,
    padding: "0.5rem",
    overflowX: "auto",
    overflowY: "hidden",
    whiteSpace: "nowrap",
    zIndex: 10,
    msOverflowStyle: "none",
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
    alignItems: "center",
    gap: isMobile ? "0.5rem" : "1rem",
  }),
  drawModeButton: (theme) => ({
    width: "2.5rem",
    height: "2.5rem",
    borderRadius: "4px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    border: `1px solid ${theme.borderColor}`,
    flexShrink: 0,
  }),
  colorPicker: (theme, isMobile) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: isMobile ? "0.5rem" : "1rem",
    padding: "0 1rem",
    minWidth: "100%",
  }),
  colorOption: (theme, isMobile) => ({
    width: isMobile ? "2.5rem" : "2rem",
    height: isMobile ? "2.5rem" : "2rem",
    borderRadius: "0",
    cursor: "pointer",
    transition: "transform 0.2s ease",
    boxShadow: `0 0 0 1px ${theme.borderColor}`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  }),
  // Removed addColorButton style (no longer needed)
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
  colorPickerWrapper: (isMobile) => ({
    position: "relative",
    zIndex: 30,
    backgroundColor: "#fff",
    borderRadius: "4px",
    boxShadow: "0 0 10px rgba(0, 0, 0, 0.3)",
    padding: "1rem",
    transform: isMobile ? "scale(0.85)" : "scale(1)",
    transformOrigin: "center",
  }),
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
  instructionText: (isMobile) => ({
    margin: 0,
    fontSize: isMobile ? "0.8rem" : "0.9rem",
  }),
  instructions: (theme, isMobile) => ({
    padding: "0.5rem",
    backgroundColor: theme.inputBg,
    borderTop: `1px solid ${theme.borderColor}`,
    textAlign: "center",
    fontSize: isMobile ? "1rem" : "0.8rem",
    color: theme.textColor,
    fontWeight: isMobile ? "bold" : "normal",
  }),
  mobileControls: (theme) => ({
    position: "absolute",
    bottom: "20px",
    right: "20px",
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  }),
  mobileControlButton: (theme) => ({
    backgroundColor: `${theme.buttonBg}CC`,
    color: theme.textColor,
    border: `1px solid ${theme.borderColor}`,
    padding: "10px 15px",
    borderRadius: "50px",
    fontSize: "0.9rem",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
  }),
};

import { useEffect, useRef, useState } from "react";
import { Pen, Type, Palette, RotateCw, X } from "lucide-react";

const FILTERS = [
  { name: "Original", css: "none" },
  { name: "Brighten", css: "brightness(1.3)" },
  { name: "Darken", css: "brightness(0.7)" },
  { name: "Blur", css: "blur(5px)" },
  { name: "Sepia", css: "sepia(1)" },
  { name: "Grayscale", css: "grayscale(1)" },
];

export function ImageEditor({ imageUrl, onClose, onSave }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState(null);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState("#FF3B30");
  const [fontSize, setFontSize] = useState(24);
  const [rotation, setRotation] = useState(0);
  const [filter, setFilter] = useState("Original");
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontWeight, setFontWeight] = useState("normal");
  const [fontStyle, setFontStyle] = useState("normal");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [shadowColor, setShadowColor] = useState("#000000");
  const [textShadow, setTextShadow] = useState(false);
  const [textStroke, setTextStroke] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [textX, setTextX] = useState(50);
  const [textY, setTextY] = useState(50);
  const [textSize, setTextSize] = useState(24);
  const [elements, setElements] = useState([]);
  const [currentLine, setCurrentLine] = useState([]);
  const [draggingTextId, setDraggingTextId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [resizingTextId, setResizingTextId] = useState(null);

  const lastTouchRef = useRef({ x: 0, y: 0, time: 0 });

  const stateRef = useRef({
    tool: null,
    brushSize: 5,
    brushColor: "#FF3B30",
    isDrawing: false,
    image: null,
  });

  useEffect(() => {
    stateRef.current = {
      tool,
      brushSize,
      brushColor,
      isDrawing,
      image: stateRef.current.image,
    };
  }, [tool, brushSize, brushColor, isDrawing]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxWidth = Math.min(500, window.innerWidth - 48);
      const maxHeight = window.innerHeight * 0.5;
      const aspectRatio = img.height / img.width;

      let displayWidth = maxWidth;
      let displayHeight = maxWidth * aspectRatio;

      if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = maxHeight / aspectRatio;
      }

      canvas.width = displayWidth;
      canvas.height = displayHeight;

      stateRef.current.image = img;
      renderCanvas([]);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const renderCanvas = (elementsToRender = elements) => {
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current.image) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const filterCss = FILTERS.find((f) => f.name === filter)?.css || "none";
    ctx.filter = filterCss;
    ctx.drawImage(stateRef.current.image, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();
    ctx.filter = "none";

    elementsToRender.forEach((el) => {
      if (el.type === "line") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = 0; i < el.points.length; i += 2) {
          if (i === 0) ctx.moveTo(el.points[i], el.points[i + 1]);
          else ctx.lineTo(el.points[i], el.points[i + 1]);
        }
        ctx.stroke();
      } else if (el.type === "text") {
        const style = el.fontStyle === "italic" ? "italic" : "normal";
        const font = `${style} ${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`;
        ctx.font = font;
        ctx.fillStyle = el.textColor;

        if (el.shadow) {
          ctx.shadowColor = el.shadowColor;
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        if (el.stroke) {
          ctx.strokeStyle = el.strokeColor;
          ctx.lineWidth = 2;
          ctx.strokeText(el.text, el.x, el.y);
        }

        ctx.fillText(el.text, el.x, el.y);
        ctx.shadowColor = "transparent";
      }
    });
  };

  useEffect(() => {
    if (!isDrawing) {
      if (tool === "text" && textInput.trim() && !draggingTextId) {
        const previewElement = {
          id: "preview",
          type: "text",
          text: textInput,
          x: textX,
          y: textY,
          fontSize: textSize,
          fontFamily,
          fontWeight,
          fontStyle,
          textColor,
          shadowColor,
          shadow: textShadow,
          strokeColor,
          stroke: textStroke,
        };
        renderCanvas([...elements, previewElement]);
      } else {
        renderCanvas(elements);
      }
    }
  }, [elements, filter, rotation, tool, textInput, textX, textY, textSize, fontFamily, fontWeight, fontStyle, textColor, shadowColor, textShadow, strokeColor, textStroke, draggingTextId]);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (stateRef.current.tool === "draw") {
      setIsDrawing(true);
      setCurrentLine([x, y]);
    } else if (stateRef.current.tool === "text") {
      const clickedText = elements.find((el) => {
        if (el.type !== "text") return false;
        return x >= el.x - 20 && x <= el.x + 200 && y >= el.y - 20 && y <= el.y + 30;
      });

      if (clickedText) {
        if (e.detail === 2) {
          setEditingTextId(clickedText.id);
        } else {
          setDraggingTextId(clickedText.id);
          canvas.dataset.dragStartX = x;
          canvas.dataset.dragStartY = y;
          canvas.dataset.textStartX = clickedText.x;
          canvas.dataset.textStartY = clickedText.y;
          canvas.style.cursor = "grabbing";
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (stateRef.current.tool === "draw" && stateRef.current.isDrawing) {
      const newLine = [...currentLine, x, y];
      setCurrentLine(newLine);
      renderCanvasWithLine(newLine);
    } else if (stateRef.current.tool === "text" && draggingTextId) {
      const dx = x - Number(canvas.dataset.dragStartX);
      const dy = y - Number(canvas.dataset.dragStartY);
      const newX = Number(canvas.dataset.textStartX) + dx;
      const newY = Number(canvas.dataset.textStartY) + dy;

      setElements((prev) =>
        prev.map((el) =>
          el.id === draggingTextId
            ? { ...el, x: Math.max(0, Math.min(newX, canvas.width - 50)), y: Math.max(20, Math.min(newY, canvas.height)) }
            : el
        )
      );
    } else if (stateRef.current.tool === "text") {
      const hoveredText = elements.some((el) => {
        if (el.type !== "text") return false;
        return x >= el.x - 20 && x <= el.x + 200 && y >= el.y - 20 && y <= el.y + 30;
      });
      canvas.style.cursor = hoveredText ? "grab" : "default";
    }
  };

  const renderCanvasWithLine = (linePoints) => {
    const canvas = canvasRef.current;
    if (!canvas || !stateRef.current.image) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const filterCss = FILTERS.find((f) => f.name === filter)?.css || "none";
    ctx.filter = filterCss;
    ctx.drawImage(stateRef.current.image, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();
    ctx.filter = "none";

    elements.forEach((el) => {
      if (el.type === "line") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = 0; i < el.points.length; i += 2) {
          if (i === 0) ctx.moveTo(el.points[i], el.points[i + 1]);
          else ctx.lineTo(el.points[i], el.points[i + 1]);
        }
        ctx.stroke();
      } else if (el.type === "text") {
        const style = el.fontStyle === "italic" ? "italic" : "normal";
        const font = `${style} ${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`;
        ctx.font = font;
        ctx.fillStyle = el.textColor;
        if (el.shadow) {
          ctx.shadowColor = el.shadowColor;
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }
        if (el.stroke) {
          ctx.strokeStyle = el.strokeColor;
          ctx.lineWidth = 2;
          ctx.strokeText(el.text, el.x, el.y);
        }
        ctx.fillText(el.text, el.x, el.y);
        ctx.shadowColor = "transparent";
      }
    });

    if (linePoints && linePoints.length > 0) {
      ctx.strokeStyle = stateRef.current.brushColor;
      ctx.lineWidth = stateRef.current.brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < linePoints.length; i += 2) {
        if (i === 0) ctx.moveTo(linePoints[i], linePoints[i + 1]);
        else ctx.lineTo(linePoints[i], linePoints[i + 1]);
      }
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    const canvas = canvasRef.current;
    if (stateRef.current.tool === "draw" && currentLine.length > 0) {
      setElements((prev) => [
        ...prev,
        {
          type: "line",
          points: currentLine,
          color: stateRef.current.brushColor,
          size: stateRef.current.brushSize,
        },
      ]);
      setCurrentLine([]);
    }
    setIsDrawing(false);
    setDraggingTextId(null);
    canvas.style.cursor = "default";
  };

  const handleTouchEnd = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || stateRef.current.tool !== "text") return;

    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const now = Date.now();

    const isDoubleTap =
      Math.abs(x - lastTouchRef.current.x) < 50 &&
      Math.abs(y - lastTouchRef.current.y) < 50 &&
      now - lastTouchRef.current.time < 300;

    lastTouchRef.current = { x, y, time: now };

    if (isDoubleTap) {
      const clickedText = elements.find((el) => {
        if (el.type !== "text") return false;
        return x >= el.x - 20 && x <= el.x + 200 && y >= el.y - 20 && y <= el.y + 30;
      });
      if (clickedText) {
        setEditingTextId(clickedText.id);
      }
    }
  };

  const addText = () => {
    if (!textInput.trim()) return;

    const newTextElement = {
      id: Date.now(),
      type: "text",
      text: textInput,
      x: textX,
      y: textY,
      fontSize: textSize,
      fontFamily,
      fontWeight,
      fontStyle,
      textColor,
      shadowColor,
      shadow: textShadow,
      strokeColor,
      stroke: textStroke,
    };

    setElements((prev) => [...prev, newTextElement]);
    setTextInput("");
    setTool(null);
  };

  const updateEditingText = (updates) => {
    if (!editingTextId) return;
    setElements((prev) =>
      prev.map((el) => (el.id === editingTextId ? { ...el, ...updates } : el))
    );
  };

  const finishEditingText = () => {
    setEditingTextId(null);
  };

  const deleteEditingText = () => {
    setElements((prev) => prev.filter((el) => el.id !== editingTextId));
    setEditingTextId(null);
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    onSave(dataUrl);
  };

  return (
    <div className="flex h-full flex-col bg-black">
      {/* Toolbar Header */}
      <div className="shrink-0 border-b border-white/10 bg-black/50 p-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setTool(tool === "draw" ? null : "draw")}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                tool === "draw"
                  ? "bg-[var(--engine-accent)] text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title="Desenhar"
            >
              <Pen size={18} />
            </button>

            <button
              onClick={() => setTool(tool === "text" ? null : "text")}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                tool === "text"
                  ? "bg-[var(--engine-accent)] text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title="Texto"
            >
              <Type size={18} />
            </button>

            <button
              onClick={() => setTool(tool === "filters" ? null : "filters")}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                tool === "filters"
                  ? "bg-[var(--engine-accent)] text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title="Filtros"
            >
              <Palette size={18} />
            </button>

            <button
              onClick={() => setRotation((rotation + 90) % 360)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
              title="Rotacionar"
            >
              <RotateCw size={18} />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportImage}
              className="rounded-lg bg-[var(--engine-accent)] px-4 py-2 text-xs font-bold text-white transition hover:brightness-95"
            >
              Salvar
            </button>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Preview */}
      <div className="flex-1 overflow-hidden overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchEnd={handleTouchEnd}
            className="cursor-crosshair rounded-lg bg-white"
            style={{ maxWidth: "100%", maxHeight: "100%" }}
          />
        </div>
      </div>

      {/* Draw Options */}
      {tool === "draw" && (
        <div className="shrink-0 border-t border-white/10 bg-black/50 p-3 backdrop-blur-sm">
          <div className="flex gap-3 items-center">
            <label className="text-xs font-semibold text-white shrink-0">
              Tamanho:
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="h-2 flex-1 rounded"
            />
            <span className="text-xs text-white/70 shrink-0 w-10">
              {brushSize}px
            </span>
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded"
            />
          </div>
        </div>
      )}

      {/* Text Options */}
      {tool === "text" && (
        <div className="shrink-0 border-t border-white/10 bg-black/50 p-4 backdrop-blur-sm max-h-96 overflow-y-auto">
          <div className="space-y-3">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Digite seu texto..."
              className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:bg-white/20"
            />

            <div>
              <label className="text-xs font-semibold text-white block mb-1">
                Tamanho: {textSize}px
              </label>
              <input
                type="range"
                min="12"
                max="72"
                value={textSize}
                onChange={(e) => setTextSize(Number(e.target.value))}
                className="w-full h-2 rounded"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white block mb-1">
                Fonte
              </label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full rounded-lg bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:bg-[#2a2a2a] border border-white/20 focus:border-[var(--engine-accent)]"
              >
                <option value="Arial">Arial</option>
                <option value="Verdana">Verdana</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
                <option value="Impact">Impact</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFontWeight(fontWeight === "bold" ? "normal" : "bold")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  fontWeight === "bold"
                    ? "bg-[var(--engine-accent)] text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Negrito
              </button>
              <button
                onClick={() => setFontStyle(fontStyle === "italic" ? "normal" : "italic")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs italic transition ${
                  fontStyle === "italic"
                    ? "bg-[var(--engine-accent)] text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Itálico
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-white flex-1">
                Cor do texto
              </label>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTextShadow(!textShadow)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  textShadow
                    ? "bg-[var(--engine-accent)] text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Sombra
              </button>
              <button
                onClick={() => setTextStroke(!textStroke)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  textStroke
                    ? "bg-[var(--engine-accent)] text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Contorno
              </button>
            </div>

            {textShadow && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-white flex-1">
                  Cor da sombra
                </label>
                <input
                  type="color"
                  value={shadowColor}
                  onChange={(e) => setShadowColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded"
                />
              </div>
            )}

            {textStroke && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-white flex-1">
                  Cor do contorno
                </label>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-white block mb-1">
                  X: {textX}
                </label>
                <input
                  type="range"
                  min="0"
                  max={canvasRef.current?.width || 500}
                  value={textX}
                  onChange={(e) => setTextX(Number(e.target.value))}
                  className="w-full h-2 rounded"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white block mb-1">
                  Y: {textY}
                </label>
                <input
                  type="range"
                  min="0"
                  max={canvasRef.current?.height || 500}
                  value={textY}
                  onChange={(e) => setTextY(Number(e.target.value))}
                  className="w-full h-2 rounded"
                />
              </div>
            </div>

            <button
              onClick={addText}
              disabled={!textInput.trim()}
              className="w-full rounded-lg bg-[var(--engine-accent)] px-3 py-2 text-xs font-bold text-white transition hover:brightness-95 disabled:opacity-50"
            >
              Adicionar Texto
            </button>
          </div>
        </div>
      )}

      {/* Filter Options */}
      {tool === "filters" && (
        <div className="shrink-0 border-t border-white/10 bg-black/50 p-3 backdrop-blur-sm">
          <div className="flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.name}
                onClick={() => setFilter(f.name)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  filter === f.name
                    ? "bg-[var(--engine-accent)] text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text Editing Mode */}
      {editingTextId && (() => {
        const editingEl = elements.find((el) => el.id === editingTextId);
        return editingEl ? (
          <div className="shrink-0 border-t border-white/10 bg-black/50 p-4 backdrop-blur-sm max-h-96 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-white">Editar Texto</span>
                <button
                  onClick={finishEditingText}
                  className="text-xs text-white/70 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                value={editingEl.text}
                onChange={(e) => updateEditingText({ text: e.target.value })}
                placeholder="Editar texto..."
                className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:bg-white/20"
              />

              <div>
                <label className="text-xs font-semibold text-white block mb-1">
                  Tamanho: {editingEl.fontSize}px
                </label>
                <input
                  type="range"
                  min="12"
                  max="72"
                  value={editingEl.fontSize}
                  onChange={(e) => updateEditingText({ fontSize: Number(e.target.value) })}
                  className="w-full h-2 rounded"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-white flex-1">
                  Cor
                </label>
                <input
                  type="color"
                  value={editingEl.textColor}
                  onChange={(e) => updateEditingText({ textColor: e.target.value })}
                  className="h-10 w-16 cursor-pointer rounded"
                />
              </div>

              <button
                onClick={deleteEditingText}
                className="w-full rounded-lg bg-red-500/20 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/30"
              >
                Deletar Texto
              </button>

              <button
                onClick={finishEditingText}
                className="w-full rounded-lg bg-[var(--engine-accent)] px-3 py-2 text-xs font-bold text-white transition hover:brightness-95"
              >
                Pronto
              </button>
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}

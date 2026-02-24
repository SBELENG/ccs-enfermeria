/**
 * RadarChart – Gráfico hexagonal SVG animado para mostrar distribución de roles CCS.
 * Uso: <RadarChart scores={{ organizador: 80, analitico: 60, ... }} size={260} />
 */
import { ROLES, type RolKey } from '@ccs/ui';

interface Props {
    scores: Record<RolKey, number>;
    size?: number;
}

const ROLES_ORDER: RolKey[] = ['organizador', 'analitico', 'ejecutor', 'creativo', 'conciliador', 'motivador'];
const N = ROLES_ORDER.length;

/** Convierte índice de vértice (ángulo) a coordenadas x,y en el polygon */
function punto(idx: number, radio: number, cx: number, cy: number): [number, number] {
    // Empezamos en -90° (arriba) y giramos en sentido horario
    const ang = (Math.PI * 2 * idx) / N - Math.PI / 2;
    return [cx + radio * Math.cos(ang), cy + radio * Math.sin(ang)];
}

function pts(radios: number[], cx: number, cy: number): string {
    return radios.map((r, i) => punto(i, r, cx, cy).join(',')).join(' ');
}

export default function RadarChart({ scores, size = 260 }: Props) {
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.38;   // radio máximo del hexágono
    const labelR = size * 0.47; // radio de las etiquetas

    const max = Math.max(...Object.values(scores), 1);
    const niveles = [0.25, 0.5, 0.75, 1];

    // Construir puntos del polígono de datos normalizados
    const radiosData = ROLES_ORDER.map(k => (scores[k] / max) * maxR);
    const ptsData = pts(radiosData, cx, cy);

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ overflow: 'visible' }}
            aria-label="Gráfico de competencias"
        >
            <defs>
                <radialGradient id="radarGrad" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="#2dc9a8" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#3a6bc8" stopOpacity="0.15" />
                </radialGradient>
            </defs>

            {/* Anillos de fondo */}
            {niveles.map(nivel => (
                <polygon
                    key={nivel}
                    points={pts(Array(N).fill(maxR * nivel), cx, cy)}
                    fill="none"
                    stroke="#e2eaf2"
                    strokeWidth={nivel === 1 ? 1.5 : 1}
                />
            ))}

            {/* Ejes radiales */}
            {ROLES_ORDER.map((_, i) => {
                const [x, y] = punto(i, maxR, cx, cy);
                return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2eaf2" strokeWidth={1} />;
            })}

            {/* Polígono de datos con animación */}
            <polygon
                points={pts(Array(N).fill(0), cx, cy)} // empieza en 0
                fill="url(#radarGrad)"
                stroke="#2dc9a8"
                strokeWidth={2}
                strokeLinejoin="round"
            >
                <animate
                    attributeName="points"
                    from={pts(Array(N).fill(0), cx, cy)}
                    to={ptsData}
                    dur="0.8s"
                    fill="freeze"
                    calcMode="spline"
                    keySplines="0.4 0 0.2 1"
                    keyTimes="0;1"
                />
            </polygon>

            {/* Puntos en los vértices */}
            {ROLES_ORDER.map((k, i) => {
                const r = radiosData[i];
                const [x, y] = punto(i, r, cx, cy);
                return (
                    <circle key={k} cx={x} cy={y} r={4} fill="#2dc9a8" stroke="white" strokeWidth={1.5}>
                        <animate
                            attributeName="r"
                            from="0"
                            to="4"
                            dur="0.8s"
                            fill="freeze"
                        />
                    </circle>
                );
            })}

            {/* Etiquetas con ícono + puntaje */}
            {ROLES_ORDER.map((k, i) => {
                const [lx, ly] = punto(i, labelR, cx, cy);
                const rol = ROLES[k];
                const pct = Math.round((scores[k] / max) * 100);
                // Alinear texto según posición
                const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';
                return (
                    <g key={k}>
                        <text
                            x={lx}
                            y={ly - 6}
                            textAnchor={anchor}
                            fontSize="13"
                            dominantBaseline="auto"
                        >
                            {rol.icon}
                        </text>
                        <text
                            x={lx}
                            y={ly + 9}
                            textAnchor={anchor}
                            fontSize="9"
                            fill="#5a7191"
                            fontFamily="DM Sans, sans-serif"
                            fontWeight="600"
                        >
                            {pct}%
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

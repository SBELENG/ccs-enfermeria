import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polygon, Line, Circle, G, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ROLES, type RolKey } from '@ccs/ui';

interface Props {
    scores: Record<RolKey, number>;
    size?: number;
}

const ROLES_ORDER: RolKey[] = ['organizador', 'analitico', 'ejecutor', 'creativo', 'conciliador', 'motivador'];
const N = ROLES_ORDER.length;

function punto(idx: number, radio: number, cx: number, cy: number): [number, number] {
    const ang = (Math.PI * 2 * idx) / N - Math.PI / 2;
    return [cx + radio * Math.cos(ang), cy + radio * Math.sin(ang)];
}

function pts(radios: number[], cx: number, cy: number): string {
    return radios.map((r, i) => punto(i, r, cx, cy).join(',')).join(' ');
}

export default function RadarChart({ scores, size = 260 }: Props) {
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.35;
    const labelR = size * 0.44;

    const max = Math.max(...Object.values(scores), 1);
    const niveles = [0.25, 0.5, 0.75, 1];

    const radiosData = ROLES_ORDER.map(k => ((scores[k] || 0) / max) * maxR);
    const ptsData = pts(radiosData, cx, cy);

    return (
        <View style={{ alignItems: 'center', justifyContent: 'center', height: size, width: size }}>
            <Svg width={size} height={size}>
                <Defs>
                    <RadialGradient id="radarGrad" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%" gradientUnits="userSpaceOnUse">
                        <Stop offset="0%" stopColor="#2dc9a8" stopOpacity="0.3" />
                        <Stop offset="100%" stopColor="#3a6bc8" stopOpacity="0.1" />
                    </RadialGradient>
                </Defs>

                {/* Anillos */}
                {niveles.map(nivel => (
                    <Polygon
                        key={nivel}
                        points={pts(Array(N).fill(maxR * nivel), cx, cy)}
                        fill="none"
                        stroke="#e2eaf2"
                        strokeWidth={nivel === 1 ? 1.5 : 1}
                    />
                ))}

                {/* Ejes */}
                {ROLES_ORDER.map((_, i) => {
                    const [x, y] = punto(i, maxR, cx, cy);
                    return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2eaf2" strokeWidth={1} />;
                })}

                {/* Datos */}
                <Polygon
                    points={ptsData}
                    fill="url(#radarGrad)"
                    stroke="#2dc9a8"
                    strokeWidth={2}
                    strokeLinejoin="round"
                />

                {/* Puntos */}
                {ROLES_ORDER.map((k, i) => {
                    const r = radiosData[i];
                    const [x, y] = punto(i, r, cx, cy);
                    return <Circle key={k} cx={x} cy={y} r={3} fill="#2dc9a8" stroke="white" strokeWidth={1} />;
                })}

                {/* Etiquetas */}
                {ROLES_ORDER.map((k, i) => {
                    const [lx, ly] = punto(i, labelR, cx, cy);
                    const rol = ROLES[k];
                    const pct = Math.round(((scores[k] || 0) / max) * 100);
                    const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';

                    return (
                        <G key={k}>
                            <SvgText
                                x={lx}
                                y={ly - 4}
                                textAnchor={anchor}
                                fontSize="12"
                                fill="#1a2b5e"
                            >
                                {rol.icon}
                            </SvgText>
                            <SvgText
                                x={lx}
                                y={ly + 10}
                                textAnchor={anchor}
                                fontSize="9"
                                fill="#64748b"
                                fontWeight="bold"
                            >
                                {pct}%
                            </SvgText>
                        </G>
                    );
                })}
            </Svg>
        </View>
    );
}

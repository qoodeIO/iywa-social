// The handle under the QR code, painted with the same gradient as the dots (SVG text).
import Svg, { Defs, LinearGradient, Stop, Text } from "react-native-svg";

export default function MaskedText({ text, colors, size = 20, width = 216 }) {
  return (
    <Svg width={width} height={size * 1.4} accessibilityLabel={text}>
      <Defs>
        <LinearGradient id="qr-text" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Text x={width / 2} y={size * 1.05} fontSize={size} fontWeight="800" letterSpacing={-0.4} textAnchor="middle" fill="url(#qr-text)">{text}</Text>
    </Svg>
  );
}

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Colors from '@/constants/colors';

interface MathTextProps {
  text: string;
  style?: object;
  fontSize?: number;
  color?: string;
}

const EXPLICIT_DELIMITERS = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\[(\[][\s\S]+?\\[)\]]/;

const BACKSLASH_COMMAND = /\\(?:frac|sqrt|int|sum|prod|lim|infty|alpha|beta|gamma|delta|theta|pi|sigma|omega|partial|nabla|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|rightarrow|leftarrow|Rightarrow|Leftarrow|Delta|Omega|Sigma|Pi|Phi|Lambda|Gamma|epsilon|zeta|eta|kappa|lambda|mu|nu|rho|tau|phi|chi|psi|vec|hat|bar|dot|ddot|tilde|overline|underline|overbrace|underbrace|binom|log|ln|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|max|min|sup|inf|det|gcd|deg|hom|ker|dim|arg|exp|text|mathrm|mathbf|mathit|mathbb|mathcal|left|right|Big|big|Bigg|bigg|begin|end|quad|qquad|displaystyle|textstyle)\s*[{([\d]/;

function containsLatex(text: string): boolean {
  if (!text) return false;
  if (EXPLICIT_DELIMITERS.test(text)) return true;
  if (BACKSLASH_COMMAND.test(text)) return true;
  if (/\^\{[^}]+\}|_\{[^}]+\}/.test(text)) return true;
  return false;
}

function ensureDelimiters(text: string): string {
  if (EXPLICIT_DELIMITERS.test(text)) {
    return text;
  }

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const match = remaining.match(/(\\[a-zA-Z]+(?:\{[^}]*\})*(?:\s*[\^_]\{[^}]*\})*|[\^_]\{[^}]*\})/);

    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    const before = remaining.slice(0, match.index);
    const latexPart = match[0];
    remaining = remaining.slice(match.index + latexPart.length);

    if (before) {
      parts.push(before);
    }

    if (latexPart.startsWith('\\') || /[\^_]\{/.test(latexPart)) {
      parts.push(`$${latexPart}$`);
    } else {
      parts.push(latexPart);
    }
  }

  return parts.join('');
}

function generateKatexHtml(text: string, fontSize: number, color: string): string {
  const processed = ensureDelimiters(text);
  const escaped = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\$/g, '@@DOLLAR@@');

  const restored = escaped.replace(/@@DOLLAR@@/g, '$');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${fontSize}px;
      color: ${color};
      line-height: 1.5;
      padding: 2px 0;
      background: transparent;
      -webkit-text-size-adjust: 100%;
    }
    .katex { font-size: 1.1em; }
    .katex-display { margin: 4px 0; overflow-x: auto; overflow-y: hidden; }
    .katex-display > .katex { text-align: left; }
    #content { word-wrap: break-word; overflow-wrap: break-word; }
  </style>
</head>
<body>
  <div id="content">${restored}</div>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      renderMathInElement(document.getElementById('content'), {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\\\(', right: '\\\\)', display: false},
          {left: '\\\\[', right: '\\\\]', display: true}
        ],
        throwOnError: false,
        trust: true,
      });
      sendHeight();
      setTimeout(sendHeight, 100);
      setTimeout(sendHeight, 500);
    });

    function sendHeight() {
      var h = document.getElementById('content').scrollHeight;
      if (h < 10) h = document.body.scrollHeight;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ height: h }));
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(JSON.stringify({ type: 'mathHeight', height: h }), '*');
      }
    }
  </script>
</body>
</html>`;
}

function MathTextNative({ text, style, fontSize = 18, color = Colors.text }: MathTextProps) {
  const [webViewHeight, setWebViewHeight] = useState(36);
  const [loaded, setLoaded] = useState(false);
  const hasMath = useMemo(() => containsLatex(text), [text]);
  const html = useMemo(() => generateKatexHtml(text, fontSize, color), [text, fontSize, color]);
  const plainText = useMemo(() => hasMath ? latexToPlainText(text) : text, [text, hasMath]);

  const WebView = useMemo(() => {
    try {
      return require('react-native-webview').default;
    } catch {
      return null;
    }
  }, []);

  if (!hasMath) {
    return <Text style={style}>{text}</Text>;
  }

  if (!WebView) {
    return <Text style={style}>{plainText}</Text>;
  }

  return (
    <View style={[mathStyles.container, { minHeight: webViewHeight }]}>
      {!loaded && <Text style={[style, { position: 'absolute', top: 0, left: 0, right: 0 }]}>{plainText}</Text>}
      <WebView
        source={{ html }}
        style={[mathStyles.webView, { height: webViewHeight, opacity: loaded ? 1 : 0 }]}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        originWhitelist={['*']}
        onMessage={(event: any) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.height && data.height > 0) {
              setWebViewHeight(Math.max(Math.ceil(data.height) + 4, 30));
              setLoaded(true);
            }
          } catch (e) {
            console.log('MathText message parse error:', e);
          }
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onShouldStartLoadWithRequest={() => true}
        onError={() => setLoaded(false)}
      />
    </View>
  );
}

function MathTextWeb({ text, style, fontSize = 18, color = Colors.text }: MathTextProps) {
  const [iframeHeight, setIframeHeight] = useState(36);
  const [loaded, setLoaded] = useState(false);
  const hasMath = useMemo(() => containsLatex(text), [text]);
  const html = useMemo(() => generateKatexHtml(text, fontSize, color), [text, fontSize, color]);
  const plainText = useMemo(() => hasMath ? latexToPlainText(text) : text, [text, hasMath]);
  const iframeId = useRef(
    useMemo(() => `math-${Math.random().toString(36).slice(2)}`, [])
  );

  useEffect(() => {
    if (!hasMath) return;
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'mathHeight' && data.height && data.height > 0) {
          setIframeHeight(Math.max(Math.ceil(data.height) + 4, 30));
          setLoaded(true);
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [hasMath]);

  useEffect(() => {
    setLoaded(false);
  }, [text]);

  if (!hasMath) {
    return <Text style={style}>{text}</Text>;
  }

  const blob = typeof Blob !== 'undefined' ? new Blob([html], { type: 'text/html' }) : null;
  const blobUrl = blob && typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';

  return (
    <View style={[mathStyles.container, { minHeight: iframeHeight }]}>
      {!loaded && <Text style={[style, { position: 'absolute', top: 0, left: 0, right: 0 }]}>{plainText}</Text>}
      {/* @ts-ignore - iframe is valid on web */}
      <iframe
        id={iframeId.current}
        src={blobUrl}
        style={{
          border: 'none',
          width: '100%',
          height: iframeHeight,
          backgroundColor: 'transparent',
          overflow: 'hidden',
          opacity: loaded ? 1 : 0,
        }}
        scrolling="no"
      />
    </View>
  );
}

export default function MathText(props: MathTextProps) {
  if (Platform.OS === 'web') {
    return <MathTextWeb {...props} />;
  }
  return <MathTextNative {...props} />;
}

export { containsLatex, latexToPlainText };

function latexToPlainText(text: string): string {
  if (!text) return '';
  let result = text;

  result = result.replace(/\$\$([\s\S]+?)\$\$/g, '$1');
  result = result.replace(/\$([^$\n]+?)\$/g, '$1');
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, '$1');
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, '$1');

  result = result.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)');
  result = result.replace(/\\sqrt\{([^}]*)\}/g, '\u221A($1)');
  result = result.replace(/\\sqrt\[([^\]]*)\]\{([^}]*)\}/g, '\u221A[$1]($2)');

  const greekMap: Record<string, string> = {
    alpha: '\u03B1', beta: '\u03B2', gamma: '\u03B3', delta: '\u03B4',
    epsilon: '\u03B5', zeta: '\u03B6', eta: '\u03B7', theta: '\u03B8',
    kappa: '\u03BA', lambda: '\u03BB', mu: '\u03BC', nu: '\u03BD',
    pi: '\u03C0', rho: '\u03C1', sigma: '\u03C3', tau: '\u03C4',
    phi: '\u03C6', chi: '\u03C7', psi: '\u03C8', omega: '\u03C9',
    Delta: '\u0394', Gamma: '\u0393', Lambda: '\u039B', Omega: '\u03A9',
    Phi: '\u03A6', Pi: '\u03A0', Sigma: '\u03A3', Theta: '\u0398',
    infty: '\u221E', partial: '\u2202', nabla: '\u2207',
  };
  for (const [cmd, sym] of Object.entries(greekMap)) {
    result = result.replace(new RegExp('\\\\' + cmd + '(?![a-zA-Z])', 'g'), sym);
  }

  const symbolMap: Record<string, string> = {
    cdot: '\u00B7', times: '\u00D7', div: '\u00F7', pm: '\u00B1', mp: '\u2213',
    leq: '\u2264', geq: '\u2265', neq: '\u2260', approx: '\u2248', equiv: '\u2261',
    rightarrow: '\u2192', leftarrow: '\u2190', Rightarrow: '\u21D2', Leftarrow: '\u21D0',
    sum: '\u2211', prod: '\u220F', int: '\u222B',
  };
  for (const [cmd, sym] of Object.entries(symbolMap)) {
    result = result.replace(new RegExp('\\\\' + cmd + '(?![a-zA-Z])', 'g'), sym);
  }

  const supMap: Record<string, string> = {
    '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3',
    '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077',
    '8': '\u2078', '9': '\u2079', '+': '\u207A', '-': '\u207B',
    '=': '\u207C', '(': '\u207D', ')': '\u207E', 'n': '\u207F',
    'i': '\u2071',
  };
  const subMap: Record<string, string> = {
    '0': '\u2080', '1': '\u2081', '2': '\u2082', '3': '\u2083',
    '4': '\u2084', '5': '\u2085', '6': '\u2086', '7': '\u2087',
    '8': '\u2088', '9': '\u2089', '+': '\u208A', '-': '\u208B',
    '=': '\u208C', '(': '\u208D', ')': '\u208E',
  };

  result = result.replace(/\^\{([^}]*)\}/g, (_, content) => {
    return content.split('').map((c: string) => supMap[c] || c).join('');
  });
  result = result.replace(/_\{([^}]*)\}/g, (_, content) => {
    return content.split('').map((c: string) => subMap[c] || c).join('');
  });
  result = result.replace(/\^([0-9])/g, (_, c) => supMap[c] || c);
  result = result.replace(/_([0-9])/g, (_, c) => subMap[c] || c);

  result = result.replace(/\\(?:text|mathrm|mathbf|mathit|mathbb|mathcal)\{([^}]*)\}/g, '$1');
  result = result.replace(/\\(?:left|right|Big|big|Bigg|bigg|displaystyle|textstyle)\s*/g, '');
  result = result.replace(/\\(?:quad|qquad)/g, '  ');
  result = result.replace(/\\,/g, ' ');
  result = result.replace(/\\(?:log|ln|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|max|min|sup|inf|det|gcd|deg|lim|exp)(?![a-zA-Z])/g, (m) => m.slice(1));
  result = result.replace(/\{|\}/g, '');
  result = result.replace(/\\/g, '');
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

const mathStyles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: 'transparent',
    opacity: 0.99,
  },
});

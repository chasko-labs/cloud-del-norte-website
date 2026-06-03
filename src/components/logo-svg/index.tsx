// Inline SVG version of the canonical brand mark — star artwork with
// theme-responsive CSS custom property fills and animated bulbs/arms.

import type { SVGProps } from "react";

const STYLES = `
  /* cdn-bulb-blink — fiona-LED rhythm (src/components/navigation/fiona.css L2436-2468).
     6-stop keyframe: bright plateau (0-28%) → cooling dim with hue drift (42%) →
     cold floor (62%) → warming back (78%) → bright (100%). Filament metaphor:
     desaturate + hue-rotate as it cools, NOT a flat opacity pulse.
     Filter chains url(#cdn-bulb-glow) + drop-shadow halo + saturate + hue-rotate
     so a single animation drives both opacity and color/glow simultaneously. */
  @keyframes cdn-bulb-blink {
    0% {
      opacity: 1;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 3px #c8a0ff) saturate(1) hue-rotate(0deg);
    }
    28% {
      opacity: 1;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 4px #d8b4ff) saturate(1) hue-rotate(0deg);
    }
    42% {
      opacity: 0.55;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 2px #b6a0d8) saturate(0.65) hue-rotate(-12deg);
    }
    62% {
      opacity: 0.22;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 1px #aea2c4) saturate(0.4) hue-rotate(-20deg);
    }
    78% {
      opacity: 0.7;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 2px #c0a4e4) saturate(0.85) hue-rotate(-6deg);
    }
    100% {
      opacity: 1;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 3px #c8a0ff) saturate(1) hue-rotate(0deg);
    }
  }
  /* Arm rhythm — slower call-and-response below the bulbs. Same 6-stop fiona
     vocabulary but stretched (longer durations on the elements) and shallower
     dim floor (arms are large fills, full dim looks like a flicker out).
     Opacity removed from this keyframe — .cdn-arm opacity is now driven by
     --cdn-mid (audio reactive). Filter transitions retained. */
  @keyframes cdn-arm-blink {
    0%   { filter: url(#cdn-arm-glow) saturate(1) hue-rotate(-4deg); }
    28%  { filter: url(#cdn-arm-glow) saturate(1) hue-rotate(0deg); }
    42%  { filter: url(#cdn-arm-glow) saturate(0.8) hue-rotate(8deg); }
    62%  { filter: url(#cdn-arm-glow) saturate(0.7) hue-rotate(14deg); }
    78%  { filter: url(#cdn-arm-glow) saturate(0.9) hue-rotate(4deg); }
    100% { filter: url(#cdn-arm-glow) saturate(1) hue-rotate(-4deg); }
  }
  /* Audio-reactive couplings — :root cascade exposes --cdn-bass / --cdn-mid /
     --cdn-flux from src/lib/background-viz/audio.ts. Defaults to 0 when silent
     (per @property initial-value), so silent = identical to pre-reactive state. */
  .cdn-bulb {
    filter: url(#cdn-bulb-glow);
    transform: scale(calc(1 + var(--cdn-bass, 0) * 0.18));
    transform-origin: center;
    transform-box: fill-box;
  }
  /* Mid-band breathes the arm fill silhouette — instruments/vocals make the
     arms "fill in" from a 0.7 floor up to 1.0 at full mid. */
  .cdn-arm  {
    filter: url(#cdn-arm-glow);
    opacity: calc(0.7 + var(--cdn-mid, 0) * 0.3);
  }
  /* cdn-bulb-tip-hero — asymmetric focal point on the topmost tip (574,351).
     Same blink cadence as siblings but a brighter, wider drop-shadow extends
     its halo a few px beyond peer bulbs at nav size (60-80px). Halo IS the
     visible element here — bulb path itself is ~2px, the glow reads as
     a localized pinpoint of intensity. Picks one tip as a natural focal
     point rather than 5 equal stars. */
  @keyframes cdn-bulb-blink-hero {
    0% {
      opacity: 1;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 5px #e0c0ff) drop-shadow(0 0 9px #b894ff) saturate(1.1) hue-rotate(0deg);
    }
    28% {
      opacity: 1;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 7px #f0d4ff) drop-shadow(0 0 12px #c8a8ff) saturate(1.15) hue-rotate(0deg);
    }
    42% {
      opacity: 0.65;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 4px #c8b4e8) saturate(0.7) hue-rotate(-12deg);
    }
    62% {
      opacity: 0.32;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 2px #b8a8d0) saturate(0.45) hue-rotate(-20deg);
    }
    78% {
      opacity: 0.8;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 4px #d0b4f0) saturate(0.9) hue-rotate(-6deg);
    }
    100% {
      opacity: 1;
      filter: url(#cdn-bulb-glow) drop-shadow(0 0 5px #e0c0ff) drop-shadow(0 0 9px #b894ff) saturate(1.1) hue-rotate(0deg);
    }
  }
  /* Hero tip — focal point of the mark. Flux (spectral onset / transients)
     ignites a halo: 6px at rest, up to 20px on snare/vocal attacks. The
     keyframe (cdn-bulb-blink-hero, prefers-reduced-motion: no-preference)
     overrides this filter while animating; under reduced-motion this rule
     stands and flux drives the halo directly. */
  .cdn-bulb-tip-hero {
    filter: drop-shadow(0 0 calc(6px + var(--cdn-flux, 0) * 14px) rgba(155, 92, 244, 0.85));
  }
  @media (prefers-reduced-motion: no-preference) {
    /* Default duration; per-element style="animation-duration:Xs" overrides
       (12 independent durations 1.5s-3.4s, mirrors fiona .fiona-led:nth-child rhythm). */
    .cdn-bulb { animation: cdn-bulb-blink 2.4s linear infinite; }
    .cdn-arm  { animation: cdn-arm-blink 5.5s linear infinite; }
    /* Hero tip rides the same 2.5s cycle so it lands on the breathe-peak
       coupling (cdn-logo-breathe 5s = 2× this). */
    .cdn-bulb-tip-hero { animation: cdn-bulb-blink-hero 2.5s linear infinite; }
  }
  @media (prefers-reduced-motion: reduce) {
    /* Freeze audio-reactive transforms — bulbs sit at scale 1.0 regardless
       of bass amplitude. Filter halos still respond (no motion involved).
       Arm opacity still rides --cdn-mid (also no motion). */
    .cdn-bulb { transform: scale(1); }
  }
  /* Light-mode override — SVG is inlined so :root:not(.awsui-dark-mode) selectors
     resolve against host theme class (not OS prefers-color-scheme). Mirrors fiona
     light-mode override (fiona.css L1049-1055) — lower opacity floor, tighter halo. */
  :root:not(.awsui-dark-mode) .cdn-bulb { opacity: 0.85; animation-name: cdn-bulb-blink-light; }
  @keyframes cdn-bulb-blink-light {
      0%   { opacity: 0.85; filter: url(#cdn-bulb-glow) drop-shadow(0 0 1.5px #c8a0ff) saturate(1) hue-rotate(0deg); }
      28%  { opacity: 0.85; filter: url(#cdn-bulb-glow) drop-shadow(0 0 2px   #d8b4ff) saturate(1) hue-rotate(0deg); }
      42%  { opacity: 0.5;  filter: url(#cdn-bulb-glow) drop-shadow(0 0 1px   #b6a0d8) saturate(0.65) hue-rotate(-12deg); }
      62%  { opacity: 0.2;  filter: url(#cdn-bulb-glow) saturate(0.4) hue-rotate(-20deg); }
      78%  { opacity: 0.6;  filter: url(#cdn-bulb-glow) drop-shadow(0 0 1px   #c0a4e4) saturate(0.85) hue-rotate(-6deg); }
      100% { opacity: 0.85; filter: url(#cdn-bulb-glow) drop-shadow(0 0 1.5px #c8a0ff) saturate(1) hue-rotate(0deg); }
  }
`;

export default function LogoSvg(props: SVGProps<SVGSVGElement>) {
	const { className, ...rest } = props;
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: brand mark; consumers wrap with aria-label
		<svg
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 169.5181 146.57036"
			width="100%"
			height="100%"
			className={`cdn-logo-svg${className ? ` ${className}` : ""}`}
			{...rest}
		>
			<defs>
				<filter
					id="cdn-bulb-glow"
					x="-400%"
					y="-400%"
					width="900%"
					height="900%"
					colorInterpolationFilters="sRGB"
				>
					<feGaussianBlur in="SourceGraphic" stdDeviation="18" result="wide" />
					<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="tight" />
					<feMerge>
						<feMergeNode in="wide" />
						<feMergeNode in="wide" />
						<feMergeNode in="tight" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				<filter
					id="cdn-arm-glow"
					x="-100%"
					y="-100%"
					width="300%"
					height="300%"
					colorInterpolationFilters="sRGB"
				>
					<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted constant css; consumed only for inline keyframes scoped to the brand mark */}
			<style dangerouslySetInnerHTML={{ __html: STYLES }} />

			<g transform="translate(-19.129816,-37.976505)">
				{/* diamonds group */}
				<path
					fill="var(--cdn-logo-primary)"
					d="m 100.35291,37.976505 -7.880123,18.608487 8.354833,13.766482 7.40542,-15.997602 z"
				/>
				<path
					fill="var(--cdn-logo-primary)"
					d="m 138.1125,159.41146 1.85208,14.68437 18.25625,10.45104 -7.01146,-18.78541 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 145.14049,165.62917 c 0.28862,1.37085 0.67901,2.59922 1.4056,3.3569 0.8529,0.67644 1.80827,0.89172 2.74506,1.19063 -0.95165,0.22 -1.97093,0.2661 -2.6293,1.24023 -0.91731,0.41403 -1.04852,1.8762 -1.33945,3.12539 -0.40592,-1.16952 -0.45382,-2.59941 -1.28985,-3.45612 -0.99305,-0.67091 -1.92438,-0.66303 -2.87734,-0.89296 1.06449,-0.33157 2.1154,-0.67865 2.87734,-1.35599 0.55219,-0.86363 0.90844,-1.94769 1.10794,-3.20808 z"
				/>
				<path
					fill="var(--cdn-logo-primary)"
					d="m 64.161458,160.99896 -1.455209,13.09687 -14.155208,7.14375 5.291667,-16.66875 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 58.076042,165.54648 c 0.288618,1.37085 0.679004,2.59922 1.405599,3.3569 0.852893,0.67644 1.808265,0.89172 2.745052,1.19063 -0.951647,0.22 -1.970923,0.2661 -2.629297,1.24023 -0.917309,0.41403 -1.048517,1.8762 -1.339453,3.12539 -0.405912,-1.16952 -0.453816,-2.59941 -1.289844,-3.45612 -0.993047,-0.67091 -1.924386,-0.66303 -2.877344,-0.89296 1.06449,-0.33157 2.115406,-0.67865 2.877344,-1.35599 0.552185,-0.86363 0.908436,-1.94769 1.107943,-3.20808 z"
				/>
				<path
					fill="var(--cdn-logo-primary)"
					d="m 19.129816,94.713638 15.575132,11.552722 10.102787,-4.8643 -10.991459,-7.623867 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 34.13125,95.4319 c 0.288618,1.370848 0.679004,2.59922 1.405599,3.356901 0.852893,0.676434 1.808265,0.891713 2.745052,1.190625 -0.951647,0.220004 -1.900765,0.663664 -2.722841,1.450704 -0.835458,0.51927 -0.954973,1.66573 -1.245909,2.91492 -0.405912,-1.16952 -0.453816,-2.59941 -1.289844,-3.45612 -0.993047,-0.67091 -2.01793,-0.35901 -2.877344,-0.892968 1.06449,-0.331567 2.583128,-0.175847 2.877344,-1.355989 0.552185,-0.863628 0.908436,-1.947682 1.107943,-3.208073 z"
				/>
				<path
					fill="var(--cdn-logo-primary)"
					d="m 158.88229,93.397915 10.31875,-10.583333 19.44687,-1.190625 -18.25625,15.610417 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 170.34537,84.392685 c 0.28862,1.37085 1.05319,2.833081 1.77978,3.590761 0.8529,0.67644 2.1527,-0.302924 3.08949,-0.004 -0.66227,0.815312 -2.3182,0.868707 -2.97657,1.842837 -0.91731,0.41403 -0.62473,2.51496 -0.91566,3.76415 -0.40592,-1.16952 -0.87477,-2.646182 -1.7108,-3.502892 -0.99305,-0.67091 -1.92438,-0.66303 -2.87734,-0.89296 1.06449,-0.33157 2.1154,-0.67865 2.87734,-1.35599 0.55219,-0.86363 0.53426,-2.181551 0.73376,-3.441941 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 100.54302,50.697764 c 0.28862,1.370848 1.04281,3.723699 1.7694,4.48138 0.85289,0.676434 2.37051,1.024005 3.30729,1.322917 -0.95164,0.220004 -3.55842,0.613369 -4.21679,1.587499 -0.91731,0.41403 -0.85008,2.256539 -1.14102,3.505729 -0.405906,-1.16952 -0.784535,-2.781311 -1.620566,-3.638021 -0.993047,-0.67091 -2.7016,-1.45678 -3.654558,-1.686718 1.06449,-0.331567 2.958766,-0.629039 3.720704,-1.30638 0.552181,-0.863628 1.63603,-3.006015 1.83554,-4.266406 z"
				/>

				{/* chevrons group */}
				<path
					className="cdn-arm"
					fill="var(--cdn-logo-arm)"
					d="m 90.099255,61.901702 4.842004,7.927593 -11.487891,27.153201 -34.701032,2.326063 -9.826418,-6.740832 39.305679,-2.373529 z"
				/>
				<path
					className="cdn-arm"
					fill="var(--cdn-logo-arm)"
					d="m 47.945336,104.62527 26.963319,19.93766 -10.538481,32.28003 -9.114361,3.41789 11.487893,-32.46991 -26.393671,-19.46296 z"
				/>
				<path
					className="cdn-arm"
					fill="var(--cdn-logo-arm)"
					d="m 67.408295,170.60944 1.51906,-9.39918 31.995205,-20.03261 31.71038,18.98826 2.37353,10.15871 -33.1345,-20.79214 z"
				/>
				<path
					className="cdn-arm"
					fill="var(--cdn-logo-arm)"
					d="m 125.89211,120.86022 11.58284,33.32438 10.72836,6.17119 -13.1019,-37.12203 28.67226,-22.69096 -8.25989,-3.133068 z"
				/>
				<path
					className="cdn-arm"
					fill="var(--cdn-logo-arm)"
					d="m 162.06473,83.073601 -8.16495,8.639657 -36.17262,2.468472 -11.67777,-25.064492 4.74706,-9.304245 12.62719,26.108848 z"
				/>

				{/* chevron bulbs */}
				<circle
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="85.063538"
					cy="83.60833"
					r="2.1166666"
					style={{ animationDelay: "0s", animationDuration: "2.4s" }}
				/>
				<circle
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="61.581772"
					cy="94.522392"
					r="2.9765625"
					style={{ animationDelay: "0.25s", animationDuration: "1.7s" }}
				/>
				<ellipse
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="58.340626"
					cy="117.07812"
					rx="2.9104166"
					ry="2.5135417"
					style={{ animationDelay: "0.5s", animationDuration: "3.1s" }}
				/>
				<ellipse
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="66.807289"
					cy="138.50937"
					rx="2.5135417"
					ry="2.3812499"
					style={{ animationDelay: "0.75s", animationDuration: "2.0s" }}
				/>
				<ellipse
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="78.581245"
					cy="159.74219"
					rx="2.1166666"
					ry="1.7859374"
					style={{ animationDelay: "1.0s", animationDuration: "2.7s" }}
				/>
				<ellipse
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="91.54583"
					cy="151.47395"
					rx="1.7197917"
					ry="1.5875"
					style={{ animationDelay: "1.25s", animationDuration: "1.5s" }}
				/>
				<ellipse
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="111.32343"
					cy="150.74635"
					rx="2.3151042"
					ry="1.9182291"
					style={{ animationDelay: "1.5s", animationDuration: "3.4s" }}
				/>
				<ellipse
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="126.53698"
					cy="160.46979"
					rx="2.4473958"
					ry="2.3812499"
					style={{ animationDelay: "1.75s", animationDuration: "1.9s" }}
				/>
				<ellipse
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="140.16302"
					cy="147.24062"
					rx="2.8442707"
					ry="2.778125"
					style={{ animationDelay: "2.0s", animationDuration: "2.5s" }}
				/>
				<ellipse
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="132.55624"
					cy="127.39687"
					rx="2.5135417"
					ry="2.3812499"
					style={{ animationDelay: "2.25s", animationDuration: "1.8s" }}
				/>
				<circle
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="144.92552"
					cy="110.26511"
					r="2.8442707"
					style={{ animationDelay: "2.5s", animationDuration: "2.9s" }}
				/>
				<ellipse
					className="cdn-bulb"
					fill="var(--cdn-logo-bulb)"
					cx="145.58698"
					cy="88.436981"
					rx="2.5796874"
					ry="2.4473958"
					style={{ animationDelay: "2.75s", animationDuration: "2.1s" }}
				/>
				<ellipse
					className="cdn-bulb-tip-hero"
					fill="var(--cdn-logo-bulb)"
					cx="114.96146"
					cy="78.052086"
					rx="3.3072915"
					ry="3.175"
					style={{ animationDelay: "0s" }}
				/>

				{/* trellis paths */}
				<path
					fill="var(--cdn-logo-primary)"
					d="m 113.24167,131.63021 1.85208,5.95312 14.94896,12.83229 -10.98021,-16.66875 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 107.15625,125.4125 2.38125,0.52917 1.5875,3.30729 -2.77813,-0.92604 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 121.84149,137.88435 c -0.11866,1.81101 -0.11353,3.49369 -2.52569,4.44335 2.86144,-1.37271 2.82593,1.11718 3.60145,2.5257 -0.0116,-1.54508 -0.95834,-3.75813 3.18051,-2.33861 -2.92631,-1.07962 -4.56958,-2.55402 -4.25627,-4.63044 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 92.736457,126.33854 -1.058333,3.04271 -2.910417,1.19062 1.058334,-3.30729 z"
				/>
				<path
					fill="var(--cdn-logo-primary)"
					d="m 86.915624,133.35 -1.852083,5.82083 -13.361459,13.62604 10.186459,-17.99166 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 79.091733,138.81979 c 0.43411,3.34614 1.392934,4.59342 2.57247,4.95785 -2.611292,-0.35661 -2.331022,2.6232 -3.461141,3.97563 0.780544,-2.64648 0.443872,-4.34762 -2.011202,-4.25626 2.274904,-0.18194 2.989073,-2.00675 2.899873,-4.67722 z"
				/>
				<path
					fill="var(--cdn-logo-primary)"
					d="m 80.962499,111.65417 -17.065625,-8.33438 -8.069791,-0.26458 15.610416,9.525 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 81.094791,104.51042 2.778125,2.91041 2.645833,-0.79375 -1.984375,-1.98437 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 70.953378,106.40668 c -0.04099,1.92515 1.010018,2.32151 2.19829,2.5257 -1.56552,0.21763 -1.744656,1.91407 -1.449937,4.11595 -0.694002,-3.2064 -1.806293,-3.69392 -2.99342,-3.69501 1.790849,0.28367 2.184678,-1.12904 2.245067,-2.94664 z"
				/>
				<path
					fill="var(--cdn-logo-primary)"
					d="m 100.0125,75.935416 -1.587501,5.55625 -0.264584,9.657291 1.5875,4.894792 2.645835,-4.894792 -0.13229,-9.657291 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 97.30052,85.691926 c 1.751848,-0.86053 3.21562,-1.901108 2.87734,-4.067969 0.53888,1.145542 -0.0884,1.416473 2.01745,3.73724 -2.25249,-1.233811 -1.64553,1.078101 -1.85208,2.38125 -0.0294,-1.763321 -0.32875,-3.231503 -3.04271,-2.050521 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 112.44792,103.84896 2.38125,-2.38125 h 3.175 l -2.77813,2.77812 z"
				/>
				<path
					fill="var(--cdn-logo-primary)"
					d="m 118.40104,108.34687 6.87917,-5.29166 12.17083,-5.027086 7.27604,-0.264584 -17.4625,10.45104 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 128.38906,107.55312 c -0.40349,-1.52665 -1.19532,-2.19893 -2.48047,-1.78593 1.34548,-1.05977 1.47958,-2.46564 1.62058,-3.86954 0.53238,1.52595 1.25118,2.67906 2.74505,2.28204 -1.23756,0.7303 -2.13634,1.67982 -1.88516,3.37343 z"
				/>
				<path
					fill="var(--cdn-logo-primary)"
					d="m 100.0125,129.51354 2.24896,5.42396 -1.32292,4.89479 -3.307291,-5.29167 z"
				/>
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 99.858575,134.00226 c 0.06049,1.68192 -1.303826,1.93904 -2.572467,2.29183 2.63362,-0.50435 2.188034,0.99278 2.478923,2.01121 0.519469,-1.21181 0.688399,-2.79752 2.993419,-2.10475 -1.19716,-0.50223 -2.64606,-0.75272 -2.899875,-2.19829 z"
				/>

				{/* center diamond */}
				<path
					fill="var(--cdn-logo-sparkle)"
					d="m 99.847134,100.44245 c 1.208806,2.92155 2.280666,5.92527 3.902606,8.59895 0.53319,1.51648 1.7521,2.73909 2.87734,4.00183 l 1.28985,1.0914 c -0.90531,0.80528 -1.82498,1.49566 -2.64584,2.97657 -1.32186,1.52882 -2.14198,3.45903 -3.04271,5.32474 -1.076,1.57203 -1.77837,3.70449 -2.513538,5.78776 -0.82042,-2.05145 -1.395636,-4.05385 -2.61276,-6.18464 l -3.042708,-5.06016 c -0.734045,-0.82571 -1.157101,-2.0246 -2.282031,-2.38125 0.638419,-0.67147 1.643782,-0.9026 1.885156,-2.05052 l 2.811198,-4.59713 2.315104,-4.92787 z"
				/>

				{/* center sparkle */}
				<path
					fill="var(--cdn-logo-primary)"
					d="m 99.91328,107.91693 c 0.2157,1.16911 0.77352,3.54094 1.42213,4.69635 0.57952,1.02163 1.9194,1.15619 2.97656,1.62058 -0.80477,0.27096 -2.73402,0.35877 -3.5388,0.9591 l -0.959109,4.26641 -0.595312,-4.13411 c 0.420169,-1.00701 -3.187393,-1.44244 -4.365625,-1.32292 0.755621,-0.38244 2.976369,-0.63637 3.571875,-1.32292 1.154982,-0.53309 1.352149,-3.52367 1.488281,-4.76249 z"
				/>
			</g>
		</svg>
	);
}

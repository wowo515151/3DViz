import { mount, makeVectorPlotter, makeIsosurfacePlotter, makeConeIsoPlotter } from "../../library/three-viz/src/index.js?v=20261012b";

const $ = selector => document.querySelector(selector);
const RANGE = 2.5;
const DEFAULT_RESOLUTION = 11;
const COLORS = Object.freeze({ electric: 0xed5363, magnetic: 0x529cff });
const ISO_OPTIONS = Object.freeze({ threshold: 0.34, nested: false, surfaceCount: 5, tubeRadius: 0.006, wireframe: true, surfaceVisible: true });
const CONE_ISO_OPTIONS = Object.freeze({ threshold: 0.34, nested: false, surfaceCount: 5, minimumArea: 0.002, maximumHeight: 0.24 });

function symbolicFamily({ id, symbol, name, short, category, description, equation, caveat, source }) {
  return {
    id, symbol, name, short, kind: category.toUpperCase(), heading: name,
    description, equation, caveat, source, renderer: "reference",
    subheading: category.toUpperCase(),
  };
}

const SOLUTIONS = Object.freeze([
  {
    id: "plane", symbol: "→", name: "Plane wave", short: "any profile · transverse",
    kind: "SOURCE-FREE PLANE WAVE", heading: "Circularly polarized plane-wave pulse",
    description: "An exact plane-fronted vacuum wave travelling along +z. This view uses a Gaussian longitudinal envelope; any sufficiently regular profile of z−t is an exact plane-wave solution.",
    equation: "u=z−t,  g(u)=exp[−u²/(2σ²)]\nF = E+iB = (x̂+i ŷ)g(u)e^{iku}\nE=Re(F),  B=Im(F);  k=1.8, σ=1.35, c=1",
    caveat: "The envelope is localized only along the propagation direction; an ideal plane wave remains uniform across the transverse plane and has infinite total energy.",
    source: "https://www.feynmanlectures.caltech.edu/II_20.html",
    subheading: "VACUUM · SOURCE-FREE · PLANE FRONTED",
  },
  {
    id: "bessel", symbol: "J₀", name: "Vector Bessel beam", short: "exact TE mode · m = 0",
    kind: "SOURCE-FREE BESSEL BEAM", heading: "Monochromatic vector Bessel beam",
    description: "An exact axisymmetric Maxwell mode built from a Hertz potential. Its longitudinal electric component is retained, so this is not a scalar or paraxial beam approximation.",
    equation: "ψ = J₀(κρ)e^{i(kz−ωt)},  k² = κ² + kz²,  ω = k\nE = ∇×∇×(ẑψ),  B = (iω)⁻¹∇×E\nEρ = kzκJ₁(κρ)sinθ,  Ez = κ²J₀(κρ)cosθ\nBφ = kκJ₁(κρ)sinθ,  θ = kz−ωt",
    caveat: "Ideal Bessel beams extend infinitely in radius and have infinite total power; the displayed field is sampled inside a finite box.",
    source: "https://www.jstage.jst.go.jp/article/jpsj1946/60/2/60_2_450/_article/-char/ja",
    subheading: "VACUUM · EXACT VECTOR MODE · INFINITE EXTENT",
  },
  {
    id: "dipole", symbol: "p(t)", name: "Retarded dipole", short: "exact point-source field · l = 1",
    kind: "RETARDED POINT-DIPOLE FIELD", heading: "Time-dependent electric dipole",
    description: "The exact retarded field of an ideal z-directed point dipole. Near, induction, and radiation terms appear together with their 1/r³, 1/r², and 1/r distance dependence.",
    equation: "u = t−r,  p(u)=cos(u)ẑ\nE = [3n(n·p)−p]/r³ + [3n(n·ṗ)−ṗ]/r²\n    + n×(n×p̈)/r\nB = −n×ṗ/r² − n×p̈/r\n(n = r⃗/r; c = 1; constants normalized)",
    caveat: "This ideal point source is singular at the origin. The core is omitted from the plotted samples; fields are exact outside it.",
    source: "https://www.feynmanlectures.caltech.edu/II_21.html",
    subheading: "RETARDED SOURCE FIELD · POINT DIPOLE · c = 1",
  },
  {
    id: "hopfion", symbol: "∞", name: "Hopfion", short: "localized null pulse · linked field lines",
    kind: "NULL VACUUM PULSE", heading: "Hopfion (linked light field)",
    description: "A finite-energy, knotted exact vacuum field. The complex Riemann–Silberstein vector gives E and B together; its field lines form linked loops.",
    equation: "F = E + iB = d⁻³ (b²−a², −i(a²+b²), 2ab)\na = x−iy,  b = t−i−z\nd = x²+y²+z²−(t−i)²\nE = Re(F),  B = Im(F);  c = 1",
    caveat: "Coordinates and field scale are dimensionless (natural units c = 1); the displayed vector field is normalized for visibility.",
    source: "https://arxiv.org/abs/1302.0342",
    subheading: "VACUUM · FINITE ENERGY · NULL FIELD · c = 1",
  },
  {
    id: "coulomb", symbol: "1/r²", name: "Coulomb field", short: "static point charge · exact exterior field",
    kind: "STATIC SOURCE FIELD", heading: "Coulomb electric field",
    description: "The exact exterior Maxwell field of a point charge in Minkowski spacetime. The radial field is static and falls as the inverse square of distance.",
    equation: "E = q r̂/r²,  B = 0\n∇·E = 4πq δ³(r);  ∇×E = 0\nc = 1, constants normalized",
    caveat: "The field is singular at the point charge. The source core is excluded from the plotted grid.",
    source: "https://www.feynmanlectures.caltech.edu/II_20.html",
    subheading: "MINKOWSKI · STATIC · POINT SOURCE · c = 1",
  },
  {
    id: "uniform", symbol: "B₀", name: "Uniform magnetic field", short: "static vacuum field · translation invariant",
    kind: "SOURCE-FREE STATIC FIELD", heading: "Uniform magnetic field",
    description: "A constant magnetic field is an exact source-free Maxwell solution in flat spacetime. This is the local field template used in many field and particle models.",
    equation: "E = 0,  B = B₀ ẑ\n∇·B = 0,  ∇×B = 0;  ∂ₜE = ∂ₜB = 0",
    caveat: "An ideal uniform field extends infinitely and has infinite total energy.",
    source: "https://www.feynmanlectures.caltech.edu/II_20.html",
    subheading: "MINKOWSKI · SOURCE-FREE · STATIC",
  },
  {
    id: "rn", symbol: "Q,P/r²", name: "Reissner–Nordström family", short: "static dyonic spherical electrovacuum · curved spacetime",
    kind: "EINSTEIN–MAXWELL ELECTROVACUUM", heading: "Reissner–Nordström exterior",
    description: "The static spherically symmetric Einstein–Maxwell black-hole family includes electric or magnetic charge and a cosmological constant. The radial electric and magnetic fields are written in a standard exterior gauge.",
    equation: "ds² = −f dt² + f⁻¹ dr² + r²dΩ²\nf = 1−2M/r+(Q²+P²)/r²−Λr²/3\nF = (Q/r²)dt∧dr + P sinθ dθ∧dφ",
    caveat: "Curved-spacetime catalog entry. This viewer does not solve geodesics or render the curved metric; the displayed scene is a flat coordinate-space field illustration.",
    source: "https://arxiv.org/abs/gr-qc/0609096",
    subheading: "CURVED SPACETIME · EINSTEIN–MAXWELL · STATIC",
  },
  {
    id: "kn", symbol: "M,J,Q", name: "Kerr–Newman", short: "rotating charged electrovacuum · curved spacetime",
    kind: "EINSTEIN–MAXWELL ELECTROVACUUM", heading: "Kerr–Newman exterior",
    description: "The stationary, axisymmetric rotating charged black-hole solution of the coupled Einstein–Maxwell equations, with mass M, angular momentum per unit mass a, and charge Q.",
    equation: "Σ = r²+a²cos²θ\nA = −Qr/Σ (dt−a sin²θ dφ)\nF = dA;  a = J/M",
    caveat: "Curved-spacetime catalog entry. The flat scene cannot represent frame dragging or the Kerr–Newman metric; no approximate Euclidean rendering is presented as exact.",
    source: "https://arxiv.org/abs/gr-qc/0609096",
    subheading: "CURVED SPACETIME · EINSTEIN–MAXWELL · ROTATING",
  },
  symbolicFamily({
    id: "wald", symbol: "B₀, a", name: "Wald field on Kerr", short: "uniform aligned magnetic test field · curved spacetime",
    category: "Curved spacetime · exact Maxwell test field",
    description: "Wald’s solution uses the stationary and axial Killing fields of a vacuum Kerr geometry to construct an exact source-free Maxwell field that approaches a uniform magnetic field aligned with the spin axis at infinity.",
    equation: "ξ=∂ₜ,  ψ=∂φ  (Kerr Killing vectors)\nA=(B₀/2)(ψ♭+2aξ♭);  F=dA\n∇μFᵘᵛ=0 on the fixed Kerr metric",
    caveat: "This is a Maxwell test field: its stress-energy is not allowed to change the Kerr geometry. It differs from the fully backreacted Ernst magnetized black-hole solutions.",
    source: "https://doi.org/10.1103/PhysRevD.10.1680",
  }),
  {
    id: "melvin", symbol: "Λ(B)", name: "Melvin magnetic universe", short: "self-gravitating uniform flux tube · curved spacetime",
    kind: "EINSTEIN–MAXWELL ELECTROVACUUM", heading: "Melvin magnetic universe",
    description: "An exact cylindrically symmetric electrovacuum in which gravity confines magnetic flux into a self-gravitating bundle instead of allowing a uniform field to fill flat space.",
    equation: "Λ = 1 + (B₀²ρ²)/4\nds² = Λ²(−dt²+dρ²+dz²)+ρ²Λ⁻²dφ²\nA = (B₀ρ²/2Λ)dφ;  F = dA",
    caveat: "Curved-spacetime catalog entry. The cylindrical metric is described here but not embedded into the flat scene.",
    source: "https://doi.org/10.1103/PhysRev.139.B225",
    subheading: "CURVED SPACETIME · EINSTEIN–MAXWELL · CYLINDRICAL",
  },
  {
    id: "br", symbol: "AdS₂×S²", name: "Bertotti–Robinson", short: "uniform electric or magnetic electrovacuum · curved spacetime",
    kind: "EINSTEIN–MAXWELL ELECTROVACUUM", heading: "Bertotti–Robinson spacetime",
    description: "A homogeneous Einstein–Maxwell spacetime with a covariantly constant electric or magnetic field and product geometry AdS₂ × S² (or its analytic continuation).",
    equation: "ds² = L²(−cosh²χ dτ²+dχ²+dθ²+sin²θ dφ²)\nF = E₀ e⁰∧e¹  (electric branch)\nRμν = 8πTμν  (Λ = 0)",
    caveat: "Curved-spacetime catalog entry; the local geometry and field are not rendered in the flat coordinate scene.",
    source: "https://arxiv.org/abs/1211.6983",
    subheading: "CURVED SPACETIME · EINSTEIN–MAXWELL · HOMOGENEOUS",
  },
  symbolicFamily({
    id: "charged-nariai", symbol: "dS₂×S²", name: "Charged Nariai universe", short: "extremal charged de Sitter horizons · curved spacetime",
    category: "Curved spacetime · Einstein–Maxwell–Λ product solution",
    description: "The charged Nariai geometry is the limiting electrovacuum when the black-hole and cosmological horizons of a Reissner–Nordström–de Sitter solution coincide. It is a direct product of two constant-curvature two-spaces carrying a uniform electric or magnetic field.",
    equation: "ds² = L₁² ds²(dS₂) + L₂² dΩ²\nF = E·vol(dS₂) + P·vol(S²)\nL₁, L₂, E, P are constrained by Einstein–Maxwell–Λ",
    caveat: "The product radii and field strengths are coupled by the field equations; they are not independent parameters. This curved geometry is shown symbolically.",
    source: "https://arxiv.org/abs/0905.2476",
  }),
  symbolicFamily({
    id: "plebanski-hacyan", symbol: "M₂×S²", name: "Plebański–Hacyan electrovacuum", short: "flat two-space × sphere with uniform field",
    category: "Curved spacetime · Einstein–Maxwell–Λ product solution",
    description: "This exceptional homogeneous electrovacuum combines a flat two-dimensional Lorentzian factor with a curved two-sphere and a uniform electromagnetic field. It belongs to the direct-product type-D Einstein–Maxwell solutions with cosmological constant.",
    equation: "ds² = ds²(M₁,₁) + R²dΩ²\nF = E·vol(M₁,₁) + P·vol(S²)\nR, E, P are constrained by Λ and Einstein–Maxwell",
    caveat: "The curvature radius and field amplitudes satisfy algebraic coupling conditions; the flat-space renderer does not represent this product geometry.",
    source: "https://doi.org/10.1063/1.524174",
  }),
  {
    id: "mp", symbol: "U(x)", name: "Majumdar–Papapetrou", short: "extremal charged multi-centre family · curved spacetime",
    kind: "EINSTEIN–MAXWELL ELECTROVACUUM", heading: "Majumdar–Papapetrou family",
    description: "A static multi-centre electrovacuum family describing extremally charged objects in exact force balance. Its harmonic function can encode arbitrary centre locations.",
    equation: "ds² = −U⁻²dt² + U² d𝐱²\nA = ±(U⁻¹−1)dt\n∇²U = 0  away from centres",
    caveat: "Curved-spacetime catalog entry. The harmonic function defines a family; this atlas does not render its curved spatial geometry.",
    source: "https://arxiv.org/abs/gr-qc/0505142",
    subheading: "CURVED SPACETIME · EINSTEIN–MAXWELL · MULTI-CENTRE",
  },
  symbolicFamily({
    id: "iwp", symbol: "H(x)", name: "Israel–Wilson–Perjés family", short: "stationary extremal electrovacua · complex harmonic data",
    category: "Curved spacetime · stationary Einstein–Maxwell family",
    description: "A stationary electrovacuum class is generated from a complex harmonic function on flat three-space. It includes Majumdar–Papapetrou as the static real branch and admits rotating or NUT-like configurations subject to global regularity conditions.",
    equation: "ds² = −|H|⁻²(dt+ω)² + |H|²d𝐱²\n∇²H=0;  ∇×ω=i(H∇H̄−H̄∇H)\nF=dA  (A is determined by the same harmonic data)",
    caveat: "The local harmonic construction does not guarantee a regular black-hole exterior; many choices have naked singularities or nontrivial asymptotics.",
    source: "https://projecteuclid.org/journals/communications-in-mathematical-physics/volume-26/issue-2/Solutions-of-the-Einstein-Maxwell-equations-with-many-black-holes/cmp/1103858037.pdf",
  }),
  {
    id: "emwave", symbol: "H(u)", name: "Einstein–Maxwell plane wave", short: "electromagnetic pp-wave · curved spacetime",
    kind: "EINSTEIN–MAXWELL ELECTROVACUUM", heading: "Electromagnetic plane-fronted wave",
    description: "Plane-fronted electromagnetic waves can coexist with a plane-fronted gravitational wave in exact Einstein–Maxwell solutions. Their transverse profile functions are constrained by the coupled field equations.",
    equation: "ds² = −2du dv + dx²+dy² + H(u,x,y)du²\nF = du∧[Eₓ(u)dx + Eᵧ(u)dy]\nΔ⊥H ∝ −(Eₓ²+Eᵧ²)",
    caveat: "Curved-spacetime catalog entry. Exact profiles depend on the chosen coupled solution; the scene does not integrate the curved wave geometry.",
    source: "https://arxiv.org/abs/gr-qc/0502049",
    subheading: "CURVED SPACETIME · EINSTEIN–MAXWELL · PLANE FRONTED",
  },
  symbolicFamily({
    id: "bell-szekeres", symbol: "a,b", name: "Bell–Szekeres colliding waves", short: "exact electrovac interaction of two EM shock waves",
    category: "Curved spacetime · Einstein–Maxwell wave interaction",
    description: "The Bell–Szekeres solution describes the interaction region formed when two linearly polarized electromagnetic shock waves collide head-on. The coupled gravitational field makes the interaction an exact electrovacuum rather than a flat-space superposition.",
    equation: "ds²=2du dv−cos²(au−bv)dx²−cos²(au+bv)dy²\nΦ₀=b,  Φ₂=a  (interaction-region Maxwell scalars)\nThe interaction region is locally Bertotti–Robinson",
    caveat: "The formula is for the interaction region; the full solution is piecewise across the incoming shock fronts and contains distributional wavefront structure.",
    source: "https://doi.org/10.1007/BF00770217",
  }),
  symbolicFamily({
    id: "robinson-trautman", symbol: "P(u,ζ,ζ̄)", name: "Robinson–Trautman electrovacua", short: "expanding algebraically-special charged radiative fields",
    category: "Curved spacetime · radiative Einstein–Maxwell family",
    description: "Robinson–Trautman electrovacua describe expanding, shear-free null geometries coupled to an aligned Maxwell field. The angular profile evolves through the Robinson–Trautman equation, allowing exact radiative metric families with electric or magnetic charge.",
    equation: "ds²=−2Hdu²−2du dr+2r²P⁻²dζdζ̄\n2H=K−2r∂ᵤlnP−2M(u)/r+Q²/r²\nK=2P²∂ζ∂ζ̄lnP;  F=(Q/r²)du∧dr",
    caveat: "P and M are constrained by the remaining coupled Einstein–Maxwell equations; this ansatz is not a solution for arbitrary profile functions.",
    source: "https://doi.org/10.1063/1.526940",
  }),
  symbolicFamily({
    id: "fourier", symbol: "∫d³k", name: "Transverse Fourier wave packets", short: "general source-free field · arbitrary spectrum",
    category: "Minkowski · complete source-free representation",
    description: "Every sufficiently regular source-free field in flat spacetime can be expanded as a superposition of transverse plane-wave modes. The spectrum and polarization are free data subject to the vacuum dispersion and transversality constraints.",
    equation: "E=Re∫d³k a(k)e(k)e^{i(k·x−c|k|t)}\nB=Re∫d³k [k̂×a(k)e(k)]e^{i(k·x−c|k|t)}/c\nk·e(k)=0;  ω=c|k|",
    caveat: "This parameterized representation covers a vast continuum of exact fields; convergence and finite energy depend on the spectrum aₛ(k).",
    source: "https://www.feynmanlectures.caltech.edu/II_20.html",
  }),
  symbolicFamily({
    id: "rs", symbol: "E+iB", name: "Riemann–Silberstein initial-value family", short: "all vacuum fields from transverse initial data",
    category: "Minkowski · general evolution representation",
    description: "The complex Riemann–Silberstein vector packages the two real fields into a single first-order evolution equation. Any divergence-free initial field determines an exact source-free Maxwell evolution.",
    equation: "F = E + i cB\n∂ₜF = −ic∇×F,  ∇·F = 0\nF(t) = exp(−ict∇×)F(0)",
    caveat: "This is a general evolution form rather than a single named field; analytic initial data produce analytic exact solutions.",
    source: "https://arxiv.org/abs/1211.2655",
  }),
  symbolicFamily({
    id: "hertz", symbol: "Πₑ, Πₘ", name: "Hertz-potential generators", short: "scalar wave potentials generate vector Maxwell fields",
    category: "Minkowski · solution-generating representation",
    description: "Electric and magnetic Hertz vectors reduce Maxwell construction to scalar homogeneous wave equations. This representation generates plane, spherical, cylindrical and localized pulse families with exact vector components.",
    equation: "□Πₑ = □Πₘ = 0;  c = 1\nE = ∇×∇×Πₑ − ∂ₜ(∇×Πₘ)\nB = ∇×∇×Πₘ + ∂ₜ(∇×Πₑ)",
    caveat: "These source-free Hertz operators yield exact Maxwell fields; units with c≠1 introduce the corresponding factors of c and material constants.",
    source: "https://www.osti.gov/biblio/6035355",
  }),
  symbolicFamily({
    id: "spherical", symbol: "jₗ(kr)Yₗₘ", name: "Regular spherical vector multipoles", short: "complete TE/TM multipole modes · l,m",
    category: "Minkowski · source-free spherical modes",
    description: "Electric- and magnetic-type vector spherical waves form a complete basis for regular monochromatic source-free fields in a region containing the origin.",
    equation: "ψₗₘ = jₗ(kr)Yₗₘ(θ,φ)e^{−iωt}\nMₗₘ = ∇×(rψₗₘ),  Nₗₘ = k⁻¹∇×Mₗₘ\nE = aₗₘMₗₘ+bₗₘNₗₘ;  B = −i(aₗₘNₗₘ+bₗₘMₗₘ)/c",
    caveat: "Arbitrary coefficients and sums over l,m specify the polarization and spatial structure; only finitely many terms are shown in numerical models.",
    source: "https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1002/2014RS005384",
  }),
  symbolicFamily({
    id: "spherical-out", symbol: "hₗ⁽¹⁾", name: "Outgoing/incoming spherical multipoles", short: "radiating TE/TM modes · vector Hankel waves",
    category: "Minkowski · source-free exterior modes",
    description: "In a source-free exterior region, spherical multipoles use outgoing or incoming spherical Hankel functions. These are the exact radiation modes used to represent arbitrary fields outside localized sources.",
    equation: "ψₗₘ⁽±⁾ = hₗ⁽¹,²⁾(kr)Yₗₘe^{−iωt}\nMₗₘ = ∇×(rψₗₘ),  Nₗₘ = k⁻¹∇×Mₗₘ\nE = ∑(aₗₘMₗₘ+bₗₘNₗₘ);  B = −i∑(aₗₘNₗₘ+bₗₘMₗₘ)/c",
    caveat: "Outgoing fields are singular at the multipole center; the expansion is valid away from the source region.",
    source: "https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1002/2014RS005384",
  }),
  symbolicFamily({
    id: "bessel-general", symbol: "Jₘ", name: "Cylindrical TE/TM Bessel modes", short: "arbitrary azimuthal order · exact vector modes",
    category: "Minkowski · cylindrical source-free modes",
    description: "The vector Bessel family includes TE, TM, and plane-polarized modes with arbitrary integer azimuthal order. Its exact fields include longitudinal components required by Maxwell’s equations.",
    equation: "ψₘ = Jₘ(κρ)e^{imφ+i k_z z−iωt}\nκ²+k_z²=(ω/c)²;  Πₑ or Πₘ = ẑψₘ\nE,B follow from the exact Hertz curl operators",
    caveat: "Ideal modes have infinite transverse extent and power; finite apertures make physical approximations rather than exact nondiffracting beams.",
    source: "https://www.jstage.jst.go.jp/article/jpsj1946/60/2/60_2_450/_article/-char/ja",
  }),
  symbolicFamily({
    id: "elegant-lg", symbol: "Uₚₘ", name: "Nonparaxial elegant Laguerre–Gaussian TE/TM beams", short: "closed-form exact Maxwell beam families",
    category: "Minkowski · exact vector beams",
    description: "Closed-form nonparaxial TE and TM beam solutions can be built from elegant Laguerre–Gaussian scalar Helmholtz modes. They retain longitudinal fields and arbitrary radial or azimuthal polarization order.",
    equation: "(∇²+k²)ψₚₘ = 0\nΠₑ,ₘ = polarization-vector × ψₚₘ\nE,B = exact Hertz curl operators; ψₚₘ uses spherical Bessel / Legendre modes",
    caveat: "These are full-vector solutions, distinct from the paraxial Gaussian-beam approximation commonly used in optics.",
    source: "https://doi.org/10.1364/OL.33.001563",
  }),
  symbolicFamily({
    id: "weber-beams", symbol: "Wₐ(η,ξ)", name: "Weber accelerating waves", short: "parabolic-trajectory TE/TM modes · exact Helmholtz family",
    category: "Minkowski · exact accelerating vector beams",
    description: "Weber waves are closed-form, nonparaxial, time-harmonic solutions whose intensity peak follows a parabolic trajectory while approximately preserving its profile. Their scalar Helmholtz modes generate exact TE and TM Maxwell fields through Hertz potentials.",
    equation: "x+iz = (η+iξ)²/2;  σ=√(2k)\nPγ(s;a)=sᵞe^(−is²/4) ₁F₁((1+2γ)/4−ia/2;(1+2γ)/2;is²/2)\nWₐ=(|Γ₁|²P₀(σξ;a)P₀(ση;−a)+2i|Γ₃|²P₁(σξ;a)P₁(ση;−a))/(2π)\nΓ₁=Γ(¼+ia/2), Γ₃=Γ(¾+ia/2);  (∂ₓ²+∂z²+k²)Wₐ=0\nΠₑ,ₘ=ẑWₐe^(−iωt);  E,B from exact Hertz curl operators",
    caveat: "The ideal Weber beam has infinite power. Finite apertures or spectral apodization produce finite-range approximations.",
    source: "https://arxiv.org/abs/1209.4680",
  }),
  symbolicFamily({
    id: "fwm", symbol: "FWM", name: "Focus-wave modes", short: "localized wave-equation generator · Hertz lift to Maxwell",
    category: "Minkowski · localized pulse families",
    description: "Brittingham–Ziolkowski focus-wave modes are exact nonseparable solutions of the homogeneous wave equation; Hertz-potential constructions turn them into exact electromagnetic pulses.",
    equation: "ψ = e^{iβ(z+ct)−βρ²/[z₀+i(z−ct)]}\n    / [4πi(z₀+i(z−ct))],  □ψ=0\nΠₑ=ẑψ;  E=∇×∇×Πₑ,  B=∂ₜ∇×Πₑ  (c=1)",
    caveat: "A single ideal focus-wave mode is not generally finite energy; suitable spectral superpositions can make localized finite-energy pulses.",
    source: "https://www.osti.gov/biblio/6035355",
  }),
  symbolicFamily({
    id: "doughnut", symbol: "TE₀₁/TM₀₁", name: "Focused-doughnut pulses", short: "single-cycle toroidal electromagnetic pulses",
    category: "Minkowski · localized exact pulses",
    description: "The Hellwarth–Nouchi focused-doughnut families are exact broadband TE or TM vacuum pulses with toroidal wave packets and one- or one-and-a-half-cycle temporal structure.",
    equation: "τ=z−ct,  σ=z+ct,  s=ρ²/(q₁+iτ)−iσ\nf=f₀/[(q₁+iτ)(s+q₂)]  (α=1)\nHertz curl of ẑf generates exact TE; TM is its dual",
    caveat: "The α=1 modified-power-spectrum member is the classic focused-doughnut pulse; its generalization to α≥1 yields finite-energy supertoroidal families. Experimental generation still requires tailored spatiotemporal fields.",
    source: "https://doi.org/10.1103/PhysRevE.54.889",
  }),
  symbolicFamily({
    id: "supertoroidal", symbol: "α≥1", name: "Supertoroidal light pulses", short: "finite-energy toroidal pulse family · tunable topology",
    category: "Minkowski · exact structured pulses",
    description: "A one-parameter extension of the focused-doughnut pulse family produces exact finite-energy Maxwell solutions with increasingly structured toroidal fields and skyrmion textures.",
    equation: "τ=z−ct,  σ=z+ct,  s=ρ²/(q₁+iτ)−iσ\nf=f₀[q₁/(q₁+iτ)]e^{−s/q₃}/(s+q₂)^α,  α≥1\nΠ=∇×(ẑf);  E,H from exact Hertz curl operators",
    caveat: "The scalar generator satisfies the homogeneous wave equation; α and q₃ tune the topology/localization. The focused-doughnut pulse is a limiting member.",
    source: "https://doi.org/10.1038/s41467-024-48927-5",
  }),
  symbolicFamily({
    id: "complex-source", symbol: "R₍c₎", name: "Complex-source-point beams and pulses", short: "analytic beam generation from complexified multipoles",
    category: "Minkowski · exact focused-wave generators",
    description: "Complex source points displace wave-equation sources into complex coordinates, producing Gaussian-like profiles in paraxial or asymptotic regimes; analytic continuation and Hertz potentials provide electromagnetic fields.",
    equation: "R_c = √[ρ²+(z−ia)²]\nψ = e^{i(kR_c−ωt)}/R_c,  ω=ck\n(∇²−c⁻²∂ₜ²)ψ = 0 away from branch/singularity sets",
    caveat: "Branch cuts and singular source sets matter: the unregularized complex-source field is not globally nonsingular on real space.",
    source: "https://www.osti.gov/biblio/6035355",
  }),
  symbolicFamily({
    id: "xwave", symbol: "X", name: "Electromagnetic X-waves", short: "localized conical spectra · Bessel superpositions",
    category: "Minkowski · localized nondispersive pulses",
    description: "X-shaped pulses arise from exact conical superpositions of vector Bessel modes. Their spectral support is constrained to a cone, producing a peak that propagates without changing shape in the ideal model.",
    equation: "F = ∫dω S(ω)F_Bessel(κ(ω),k_z(ω))\nk_z=ω/v,  κ=(ω/c)√[1−c²/v²]\nω=c√(κ²+k_z²);  v>c for ideal X peaks",
    caveat: "Ideal X-waves have infinite energy and may have a superluminal intensity peak; no information or energy front propagates superluminally.",
    source: "https://arxiv.org/abs/physics/9712051",
  }),
  symbolicFamily({
    id: "flying-focus", symbol: "v_f", name: "Flying-focus fields", short: "exact Maxwell fields with programmable moving intensity peak",
    category: "Minkowski · exact structured pulses",
    description: "Complex-source-point multipoles combined with Lorentz transformations produce exact Maxwell fields whose focal intensity peak can travel at chosen constant velocities and carry arbitrary polarization or orbital angular momentum.",
    equation: "F_ff(x,t) = Lorentz-transform of complex-source multipole fields\nSpectrum and polarization are free design data\n∇·E=∇·B=0;  □F=0",
    caveat: "The exact field solution is not the same as the optical system used to synthesize it; laboratory realizations require tailored spatiotemporal spectra.",
    source: "https://arxiv.org/abs/2210.07947",
  }),
  symbolicFamily({
    id: "accelerating-beams", symbol: "Jₙ(ks)", name: "Non-paraxial accelerating beams", short: "exact full-Maxwell TE/TM beams · curved trajectories",
    category: "Minkowski · exact vector beams",
    description: "These TE and TM solutions of the full Maxwell equations bend along circular trajectories without using the paraxial approximation. They generalize Airy-like accelerating beams and include periodic accelerating families.",
    equation: "(∇²+k²)ψ = 0\nE,H from exact TE/TM vector solutions\nCircular-coordinate separation gives Bessel profiles Jₙ(ks)",
    caveat: "Airy beams are recovered only in a paraxial limit. The ideal circular beam has infinite power; finite apertures produce finite-range approximations. This preview shows the order-1 TE Hertz lift with a small y-directed spectral component.",
    source: "https://doi.org/10.1103/PhysRevLett.108.163901",
  }),
  symbolicFamily({
    id: "rindler-wave", symbol: "KᵢΩ/a", name: "Relativistic accelerating Maxwell waves", short: "exact TE/TM modes in Rindler spacetime",
    category: "Minkowski · exact Maxwell modes in accelerated coordinates",
    description: "A Maxwell field with fixed shape in a uniformly accelerated Rindler frame appears as an accelerating electromagnetic wave to inertial observers. Its non-relativistic limit connects to Airy-like beams.",
    equation: "ds² = −a²Z²dT²+dx²+dy²+dZ²\nU = e^{−iΩT+i k⊥·x⊥}KᵢΩ/a(k⊥Z)\nAᴱ, Aᴹ are the TE/TM potentials built from U;  F=dA",
    caveat: "The preview is restricted to the right Rindler wedge z > |t| and omits a near-horizon layer where the ideal mode diverges; the blank region is outside the sampled chart, not a claim of zero physical field. This is a coordinate-frame family in flat spacetime, not a self-gravitating field.",
    source: "https://arxiv.org/abs/1105.0631",
  }),
  symbolicFamily({
    id: "bateman", symbol: "α,β", name: "Bateman null-field construction", short: "analytic generator for infinitely many null Maxwell fields",
    category: "Minkowski · null-field generating family",
    description: "Bateman pairs generate exact null vacuum fields from complex scalar functions. Holomorphic reparameterizations create infinitely many null fields, including localized knotted and linked examples.",
    equation: "F = E+iB = ∇α×∇β\n∇α·∇α = ∇β·∇β = 0\n∇α×∇β = −i(∂ₜα∇β−∂ₜβ∇α)",
    caveat: "The construction covers null fields, not all Maxwell solutions; α and β must satisfy the Bateman conditions and regularity constraints.",
    source: "https://arxiv.org/abs/1302.0342",
  }),
  symbolicFamily({
    id: "conformal", symbol: "SO(2,4)", name: "Conformal Maxwell solution families", short: "conformal images of plane waves and seed fields",
    category: "Minkowski · symmetry-generated exact families",
    description: "Four-dimensional vacuum Maxwell theory is conformally invariant. Conformal maps applied to plane waves or other seed fields generate additional exact solutions, including localized and topologically knotted fields.",
    equation: "x′=φ(x),  g′=Ω²g\nF′_{μν}(x′)=∂x^α/∂x′μ · ∂x^β/∂x′ν · F_{αβ}(x)\nVacuum Maxwell remains invariant in 4D",
    caveat: "Coordinate singularities and global regularity depend on the conformal map and chosen seed field.",
    source: "https://arxiv.org/abs/1502.01382",
  }),
  symbolicFamily({
    id: "torus-knots", symbol: "Tₚ,ᵩ", name: "Torus-knot and link fields", short: "polynomial Bateman fields · arbitrary p,q topology",
    category: "Minkowski · knotted null fields",
    description: "Polynomial choices in the Bateman construction yield exact null fields with electric and magnetic lines arranged as torus knots or links, indexed by integer winding numbers.",
    equation: "F = ∇(αᵖ)×∇(βᵠ)\nα,β = Hopf-map Bateman pair\np,q ∈ ℕ;  field lines include Tₚ,ᵩ",
    caveat: "The knot labels specify a family of null solutions; particular fields can contain multiple linked components and nested structures.",
    source: "https://arxiv.org/abs/1302.0342",
  }),
  symbolicFamily({
    id: "ranada", symbol: "Hopf", name: "Rañada Hopf-map fields", short: "topological vacuum fields from maps S³→S²",
    category: "Minkowski · topological exact solutions",
    description: "Rañada’s construction uses maps between compactified space and the two-sphere to build source-free electromagnetic fields with nonzero helicity and linked field lines.",
    equation: "φ:S³→S²,  θ:S³→S²\nF ∝ dφ∧dθ\nHopf invariant links electric/magnetic field lines",
    caveat: "The Hopfion is one representative; conformal and polynomial generalizations generate many other exact topological fields.",
    source: "https://doi.org/10.1007/BF00401864",
  }),
  symbolicFamily({
    id: "lienard", symbol: "q,uᵐᵘ", name: "Liénard–Wiechert fields", short: "exact retarded field of any timelike point-charge trajectory",
    category: "Minkowski · retarded source fields",
    description: "The exact retarded electromagnetic field of an arbitrarily moving point charge splits into velocity and acceleration terms and applies to any smooth timelike trajectory.",
    equation: "Rᵘ = xᵘ−zᵘ(τ_ret),  R·R=0\nAᵘ = q uᵘ/(R·u)|ret\nFᵘᵛ = ∂ᵘAᵛ−∂ᵛAᵘ",
    caveat: "The field is singular on the worldline; its distributional source is the point-charge current.",
    source: "https://arxiv.org/abs/0810.4246",
  }),
  symbolicFamily({
    id: "multipole-radiation", symbol: "Qₗₘ(t)", name: "Retarded electric/magnetic multipole radiation", short: "all multipole orders · near, induction, radiation zones",
    category: "Minkowski · retarded source fields",
    description: "Retarded vector-spherical-wave expansions express fields from localized time-dependent sources at every electric and magnetic multipole order, with exact near-, induction-, and radiation-zone terms.",
    equation: "A_ret(x,t)=μ₀/(4π)∫d³x′ J(x′,t−R/c)/R  (Lorenz gauge)\nExpand in Yₗₘ and spherical Hankel functions\nE=−∇Φ−∂ₜA,  B=∇×A",
    caveat: "The multipole expansion converges in its source-free domain; truncation to a finite l range is an approximation.",
    source: "https://www.feynmanlectures.caltech.edu/II_21.html",
  }),
  symbolicFamily({
    id: "harmonic-static", symbol: "∇²Φ=0", name: "Static harmonic multipole fields", short: "electrostatic/magnetostatic source-free families",
    category: "Minkowski · static exact fields",
    description: "In a simply connected source-free static region, electrostatic and magnetostatic scalar potentials are harmonic. Arbitrary spherical-harmonic coefficients give exact multipole fields.",
    equation: "E=−∇Φ,  ∇²Φ=0\nB=−∇Ψ,  ∇²Ψ=0\nΦ,Ψ=∑ₗₘ(aₗₘrˡ+bₗₘr⁻ˡ⁻¹)Yₗₘ",
    caveat: "The coefficients and allowed radial terms depend on the source locations and boundary conditions; singular terms represent excluded sources.",
    source: "https://www.feynmanlectures.caltech.edu/II_20.html",
  }),
  symbolicFamily({
    id: "uniform-electric", symbol: "E₀", name: "Uniform electric and crossed fields", short: "constant-field family · arbitrary E₀ and B₀",
    category: "Minkowski · static exact fields",
    description: "Any spatially and temporally constant electric and magnetic vectors solve source-free Maxwell equations. Lorentz transformations classify these fields by their two electromagnetic invariants.",
    equation: "E=E₀,  B=B₀\n∇·E=∇·B=0;  ∇×E=∇×B=0\nE²−c²B²,  E·B are Lorentz invariants",
    caveat: "Uniform fields extend to infinity and have infinite total energy; the existing renderer currently samples only the uniform magnetic case.",
    source: "https://www.feynmanlectures.caltech.edu/II_20.html",
  }),
  symbolicFamily({
    id: "evanescent", symbol: "k∈ℂ³", name: "Evanescent and complex-wavevector modes", short: "exact exponential-decay plane modes",
    category: "Minkowski · monochromatic modes",
    description: "Allowing complex wavevector components yields exact Maxwell plane modes that propagate along some directions while decaying exponentially along others, subject to complex transversality and dispersion constraints.",
    equation: "E=E₀e^{i(k·x−ωt)},  B=(1/ω)k×E\nk·E=0,  k·k=(ω/c)²\nIm(k) gives spatial exponential decay",
    caveat: "An evanescent mode is generally associated with an interface or source and is not a finite-energy free-space packet by itself.",
    source: "https://doi.org/10.1088/978-0-7503-1716-0ch1",
  }),
  symbolicFamily({
    id: "weyl-electrovac", symbol: "U(ρ,z)", name: "Static axisymmetric Weyl electrovacua", short: "harmonic-potential Einstein–Maxwell families",
    category: "Curved spacetime · Einstein–Maxwell exact families",
    description: "Static axisymmetric Einstein–Maxwell systems admit Weyl-type solution-generating forms in which metric and electromagnetic potentials obey coupled reduced equations; charged multi-source solutions are included.",
    equation: "ds² = −e^{2U}dt² + e^{-2U}[e^{2k}(dρ²+dz²)+ρ²dφ²]\nA=A_t(ρ,z)dt\nEinstein–Maxwell reduces to coupled elliptic equations",
    caveat: "This is a solution-generating class; not every harmonic U is a valid electrovac solution without the coupled constraints on k and A_t.",
    source: "https://arxiv.org/abs/gr-qc/0512134",
  }),
  symbolicFamily({
    id: "pd", symbol: "m,a,n,A,e,g,Λ", name: "Plebański–Demiański family", short: "charged rotating/accelerating/NUT electrovacua",
    category: "Curved spacetime · Einstein–Maxwell–Λ exact family",
    description: "The type-D Plebański–Demiański class unifies many exact charged black-hole geometries with rotation, acceleration, NUT parameter, electric and magnetic charges, and cosmological constant.",
    equation: "ds² = Ω⁻²[−Q/Σ(dt−a sin²θ dφ)² + Σ/Q dr²\n       + Σ/P dθ² + P sin²θ/Σ(a dt−(r²+a²)dφ)²]\nΩ=1−Ar cosθ;  Σ=r²+a²cos²θ",
    caveat: "Coordinate conventions vary between forms of the family; limits recover Kerr–Newman, charged C-metric, and related exact solutions.",
    source: "https://arxiv.org/abs/gr-qc/0507021",
  }),
  symbolicFamily({
    id: "cmetric", symbol: "A,Q", name: "Charged C-metric", short: "uniformly accelerating charged black-hole electrovacuum",
    category: "Curved spacetime · Einstein–Maxwell exact solution",
    description: "The charged C-metric is an exact accelerating black-hole solution, with acceleration supported by a conical defect or external field; it is a special limit of the broader Plebański–Demiański class.",
    equation: "ds² = Ω⁻²[−f dt²+f⁻¹dr²+r²(g⁻¹dθ²+g sin²θ dφ²)]\nΩ=1+Ar cosθ;  A_t=−Q/r\nf,g depend on M,Q,A,Λ",
    caveat: "Forms and normalization conventions differ; the acceleration horizon and conical singularity are part of the global solution.",
    source: "https://arxiv.org/abs/gr-qc/0507021",
  }),
  symbolicFamily({
    id: "ernst-accelerating", symbol: "A,Q,B₀", name: "Ernst accelerating black holes", short: "charged C-metric balanced by an external field",
    category: "Curved spacetime · Einstein–Maxwell exact solution",
    description: "The Ernst solution embeds an accelerating charged black-hole pair in an external electric or magnetic universe. The applied field can balance the acceleration and remove the conical defect on both symmetry axes.",
    equation: "(g,A) = H_B₀(g_C-metric,A_C-metric)\nF = dA;  external field backreacts on g\nB₀ and Q are tuned against acceleration A",
    caveat: "This is the fully coupled Ernst solution, distinct from a test field on a fixed black-hole metric. Coordinate and gauge choices change its displayed form.",
    source: "https://arxiv.org/abs/gr-qc/9808044",
  }),
  symbolicFamily({
    id: "magnetized-black-hole", symbol: "B₀·KN", name: "Ernst magnetized black holes", short: "Harrison-generated black holes in external fields",
    category: "Curved spacetime · Einstein–Maxwell exact solutions",
    description: "Harrison transformations embed black-hole solutions in external electromagnetic universes, yielding exact magnetized Schwarzschild, Reissner–Nordström, and rotating charged configurations.",
    equation: "(g,A) = Harrison_{B₀}(g_seed,A_seed)\nSeed: Schwarzschild, RN, or Kerr–Newman\nExternal field backreacts on both metric and F=dA",
    caveat: "The transformed field includes the external background and gravitational backreaction; it is not a test-field approximation.",
    source: "https://doi.org/10.1063/1.522781",
  }),
  symbolicFamily({
    id: "harrison", symbol: "Hλ", name: "Ernst–Harrison solution generators", short: "symmetry transformations that generate electrovacua",
    category: "Curved spacetime · Einstein–Maxwell generating family",
    description: "The stationary axisymmetric Einstein–Maxwell equations admit transformations of their complex Ernst potentials that produce new exact electrovacua from seed solutions. Harrison transformations generate charged or externally magnetized fields; related transformations generate NUT and other families.",
    equation: "(ℰ,Φ) → Hλ(ℰ,Φ) = (ℰ′,Φ′)\nF′ = dA(Φ′)\nSeed metric and transformed potentials solve coupled Einstein–Maxwell",
    caveat: "This is a solution-generating symmetry, not one spacetime. Global regularity, asymptotics, and physical interpretation depend on the seed and transformation parameters.",
    source: "https://scholarsarchive.byu.edu/facpub/801/",
  }),
  symbolicFamily({
    id: "kn-ads", symbol: "Q,Λ", name: "Kerr–Newman–(anti-)de Sitter", short: "rotating charged electrovacuum · cosmological constant",
    category: "Curved spacetime · Einstein–Maxwell–Λ black hole",
    description: "This exact rotating charged black-hole family extends Kerr–Newman to de Sitter or anti-de Sitter asymptotics. It is a principal subfamily of Plebański–Demiański and has an explicit electromagnetic potential.",
    equation: "Σ = r²+a²cos²θ;  Ξ = 1−a²/L²\nA = −Qr/Σ (dt−a sin²θ/Ξ dφ);  F=dA\nΔᵣ=(r²+a²)(1+r²/L²)−2Mr+Q²;  Λ=−3/L²",
    caveat: "The displayed radial function is the AdS branch; analytic continuation gives the de Sitter branch. Coordinate normalization and angular factors vary across conventions.",
    source: "https://arxiv.org/abs/hep-th/0702129",
  }),
  symbolicFamily({
    id: "exponential-beam", symbol: "e^{-κρ}", name: "Whittaker exponential beams", short: "Bessel-wavepacket family with finite energy per unit length",
    category: "Minkowski · exact structured beams",
    description: "Whittaker representations express vacuum Maxwell fields through one complex scalar function. Exponential beams form exact angular-momentum eigenmodes and can be constructed as wave packets of Bessel beams.",
    equation: "F = E + icB;  ∂ₜF=−ic∇×F\nWhittaker scalar ψ solves □ψ=0\nTransverse profile ∝ e^{−κρ} (beam family)",
    caveat: "These modes are periodic along propagation and have finite energy per unit beam length, rather than finite total energy over all space.",
    source: "https://arxiv.org/abs/physics/0607292",
  }),
]);

// A family entry can preview one exact member without pretending to sample every
// arbitrary spectrum, multipole coefficient, or solution-generating parameter.
const SAMPLE_MODELS = Object.freeze({
  plane: "plane",
  bessel: "bessel",
  dipole: "dipole",
  hopfion: "hopfion",
  coulomb: "coulomb",
  uniform: "uniform",
  fourier: "plane",
  rs: "hopfion",
  hertz: "bessel",
  "spherical-out": "dipole",
  spherical: "spherical",
  "bessel-general": "bessel",
  bateman: "hopfion",
  conformal: "hopfion",
  ranada: "hopfion",
  "torus-knots": "hopfion",
  "complex-source": "complex-source",
  "multipole-radiation": "dipole",
  lienard: "coulomb",
  "harmonic-static": "harmonic-static",
  "uniform-electric": "uniform-electric",
  evanescent: "evanescent",
  rn: "rn",
  kn: "rn",
  wald: "wald",
  "robinson-trautman": "rn",
  "weyl-electrovac": "rn",
  mp: "mp",
  iwp: "mp",
  emwave: "plane",
  pd: "rn",
  cmetric: "rn",
  "ernst-accelerating": "rn",
  "magnetized-black-hole": "rn",
  harrison: "rn",
  "kn-ads": "rn",
  melvin: "melvin",
  br: "br",
  "bell-szekeres": "br",
  "charged-nariai": "br",
  "plebanski-hacyan": "br",
  fwm: "focus-wave",
  doughnut: "focused-doughnut",
  supertoroidal: "supertoroidal",
  xwave: "xwave-finite-spectrum",
  "flying-focus": "flying-focus",
  "elegant-lg": "elegant-lg-fundamental",
  "accelerating-beams": "accelerating-bessel",
  "weber-beams": "weber",
  "exponential-beam": "whittaker-exponential",
  "rindler-wave": "rindler-te",
});
const SAMPLED_FIELDS = new Set(Object.keys(SAMPLE_MODELS));
const SAMPLE_DESCRIPTIONS = Object.freeze({
  fourier: "single Gaussian-profile circularly polarized plane-wave mode from the arbitrary-profile family",
  rs: "Hopfion initial-data member",
  hertz: "axisymmetric TE Bessel mode",
  "spherical-out": "outgoing electric dipole (l = 1) member",
  spherical: "regular axisymmetric TE spherical dipole (l = 1) mode",
  "bessel-general": "axisymmetric TE Bessel mode (m = 0)",
  bateman: "Hopfion null-field member",
  conformal: "Hopfion null-field member",
  ranada: "Hopfion linked-field member",
  "torus-knots": "Hopfion linked-field member (p = q = 1)",
  "complex-source": "complex-shifted Coulomb field with a ring singularity",
  "multipole-radiation": "retarded electric dipole (l = 1) member",
  lienard: "static point-charge member (charge at rest)",
  "harmonic-static": "source-free electrostatic quadrupole",
  "uniform-electric": "constant crossed E/B field",
  evanescent: "TE evanescent mode with complex wavevector",
  rn: "static dyonic Reissner–Nordström exterior",
  kn: "non-rotating Reissner–Nordström member (a = 0)",
  wald: "aligned magnetic test field on Schwarzschild (a = 0)",
  "robinson-trautman": "static Reissner–Nordström member",
  "weyl-electrovac": "spherical Reissner–Nordström member",
  mp: "single-centre Majumdar–Papapetrou extremal solution",
  iwp: "single-centre real-harmonic Majumdar–Papapetrou member",
  emwave: "Gaussian-profile electromagnetic plane-wave member of an Einstein–Maxwell pp-wave family",
  pd: "non-rotating Reissner–Nordström member",
  cmetric: "zero-acceleration Reissner–Nordström limit",
  "ernst-accelerating": "zero-acceleration Reissner–Nordström limit",
  "magnetized-black-hole": "zero-external-field Reissner–Nordström member",
  harrison: "identity transformation of a Reissner–Nordström seed",
  "kn-ads": "zero-rotation, zero-cosmological-constant Reissner–Nordström member",
  melvin: "Bonnor–Melvin magnetic universe",
  br: "uniform Bertotti–Robinson electric field",
  "bell-szekeres": "Bell–Szekeres interaction region, locally Bertotti–Robinson",
  "charged-nariai": "uniform local electric field member",
  "plebanski-hacyan": "uniform local electric field member",
  fwm: "exact Brittingham focus-wave scalar lifted to a TE Maxwell field",
  doughnut: "α = 1 Hellwarth–Nouchi focused-doughnut pulse",
  supertoroidal: "α = 2 finite-energy supertoroidal pulse",
  xwave: "three-frequency exact Bessel-mode superposition on one superluminal cone",
  "flying-focus": "Lorentz-boosted complex-source field with its peak moving at 0.65c along +z",
  "elegant-lg": "p = 0, m = 0 exact nonparaxial eLG scalar mode with a TE Hertz lift",
  "accelerating-beams": "order-1 exact circular Bessel accelerating mode with a TE Hertz lift",
  "weber-beams": "symmetric non-paraxial Weber mode (separation parameter a = 0)",
  "exponential-beam": "m = 0 Whittaker exponential beam with qz = 0.9 and τ = 1.2",
  "rindler-wave": "exact TE Rindler mode with imaginary-order K profile in the right wedge, sampled away from the horizon",
});
const CURVED_REFERENCES = new Set(["rn", "kn", "wald", "melvin", "br", "charged-nariai", "plebanski-hacyan", "mp", "iwp", "emwave", "bell-szekeres", "robinson-trautman", "weyl-electrovac", "pd", "cmetric", "ernst-accelerating", "magnetized-black-hole", "harrison", "kn-ads"]);

const state = { controller: undefined, solution: "hopfion", time: 0, resolution: DEFAULT_RESOLUTION, surfaceResolution: 11, playing: false, electric: true, magnetic: true, isosurfaces: true, electricSurface: true, magneticSurface: true, coneIso: false, coneIsoSize: CONE_ISO_OPTIONS.maximumHeight, threshold: ISO_OPTIONS.threshold, nested: false, surfaceCount: ISO_OPTIONS.surfaceCount, tubeRadius: ISO_OPTIONS.tubeRadius, solidSurface: true, wireframes: true };

function complexAdd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function complexSub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function complexMul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
function complexScale(a, factor) { return [a[0] * factor, a[1] * factor]; }
function complexInverse(a) { const d = a[0] * a[0] + a[1] * a[1] || 1e-20; return [a[0] / d, -a[1] / d]; }
function complexPower(a, n) { let result = [1, 0]; for (let i = 0; i < n; i += 1) result = complexMul(result, a); return result; }

function besselJ0(x) {
  let sum = 1, term = 1, q = x * x / 4;
  for (let m = 1; m < 28; m += 1) { term *= -q / (m * m); sum += term; if (Math.abs(term) < 1e-13) break; }
  return sum;
}
function besselJ1(x) {
  let term = x / 2, sum = term, q = x * x / 4;
  for (let m = 1; m < 28; m += 1) { term *= -q / (m * (m + 1)); sum += term; if (Math.abs(term) < 1e-13) break; }
  return sum;
}

// Second-order complex jets keep the Hertz lift analytic: values, first
// derivatives, and Hessians are propagated through the closed-form scalars.
const cj = (re, im = 0) => [re, im];
const cjAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cjMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cjScale = (a, n) => [a[0] * n, a[1] * n];
const cjInv = a => { const d = a[0] * a[0] + a[1] * a[1] || 1e-24; return [a[0] / d, -a[1] / d]; };
const cjExp = a => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])]; };
function jet(value, variable = -1) {
  return {
    v: value,
    d: Array.from({ length: 4 }, (_, i) => cj(i === variable ? 1 : 0)),
    h: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => cj(0))),
    t: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => cj(0)))),
  };
}
function jetAdd(a, b) {
  return {
    v: cjAdd(a.v, b.v), d: a.d.map((x, i) => cjAdd(x, b.d[i])),
    h: a.h.map((row, i) => row.map((x, j) => cjAdd(x, b.h[i][j]))),
    t: a.t.map((plane, i) => plane.map((row, j) => row.map((x, k) => cjAdd(x, b.t[i][j][k])))),
  };
}
function jetScale(a, scale) {
  return {
    v: cjScale(a.v, scale), d: a.d.map(x => cjScale(x, scale)),
    h: a.h.map(row => row.map(x => cjScale(x, scale))),
    t: a.t.map(plane => plane.map(row => row.map(x => cjScale(x, scale)))),
  };
}
function jetMul(a, b) {
  return {
    v: cjMul(a.v, b.v),
    d: a.d.map((x, i) => cjAdd(cjMul(x, b.v), cjMul(a.v, b.d[i]))),
    h: a.h.map((row, i) => row.map((x, j) => cjAdd(cjAdd(cjMul(x, b.v), cjMul(a.d[i], b.d[j])), cjAdd(cjMul(a.d[j], b.d[i]), cjMul(a.v, b.h[i][j]))))),
    t: a.t.map((plane, i) => plane.map((row, j) => row.map((x, k) => cjAdd(
      cjAdd(cjAdd(cjMul(x, b.v), cjMul(a.h[i][j], b.d[k])), cjMul(a.h[i][k], b.d[j])),
      cjAdd(cjAdd(cjMul(a.h[j][k], b.d[i]), cjMul(a.d[i], b.h[j][k])),
        cjAdd(cjMul(a.d[j], b.h[i][k]), cjAdd(cjMul(a.d[k], b.h[i][j]), cjMul(a.v, b.t[i][j][k])))),
    )))),
  };
}
function jetUnary(a, f, fp, fpp, fppp) {
  const v = f(a.v), first = fp(a.v), second = fpp(a.v), third = fppp(a.v);
  return {
    v, d: a.d.map(x => cjMul(first, x)),
    h: a.h.map((row, i) => row.map((x, j) => cjAdd(cjMul(first, x), cjMul(second, cjMul(a.d[i], a.d[j]))))),
    t: a.t.map((plane, i) => plane.map((row, j) => row.map((x, k) => cjAdd(
      cjAdd(cjMul(first, x), cjMul(second, cjMul(a.h[i][j], a.d[k]))),
      cjAdd(cjMul(second, cjMul(a.h[i][k], a.d[j])), cjAdd(cjMul(second, cjMul(a.h[j][k], a.d[i])), cjMul(third, cjMul(cjMul(a.d[i], a.d[j]), a.d[k])))),
    )))),
  };
}
function jetInv(a) {
  return jetUnary(a, cjInv,
    x => cjScale(cjMul(cjInv(x), cjInv(x)), -1),
    x => cjScale(cjMul(cjMul(cjInv(x), cjInv(x)), cjInv(x)), 2),
    x => cjScale(cjMul(cjMul(cjMul(cjInv(x), cjInv(x)), cjInv(x)), cjInv(x)), -6));
}
function jetExp(a) {
  return jetUnary(a, cjExp, cjExp, cjExp, cjExp);
}
function cjSqrt(a) {
  const radius = Math.hypot(a[0], a[1]);
  return [Math.sqrt(Math.max(0, (radius + a[0]) / 2)), Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (radius - a[0]) / 2))];
}
function jetSqrt(a) {
  const inverseRoot = x => cjInv(cjSqrt(x));
  return jetUnary(a, cjSqrt,
    x => cjScale(inverseRoot(x), 0.5),
    x => cjScale(cjMul(cjMul(inverseRoot(x), inverseRoot(x)), inverseRoot(x)), -0.25),
    x => cjScale(cjMul(cjMul(cjMul(cjMul(inverseRoot(x), inverseRoot(x)), inverseRoot(x)), inverseRoot(x)), inverseRoot(x)), 0.375));
}
function jetPart(a, part) {
  const take = x => cj(x[part], 0);
  return { v: take(a.v), d: a.d.map(take), h: a.h.map(row => row.map(take)), t: a.t.map(plane => plane.map(row => row.map(take))) };
}
function jetHypergeometric1F1(a, b, z) {
  let sum = jet(cj(1)), term = jet(cj(1));
  for (let n = 1; n <= 90; n += 1) {
    term = jetScale(jetMul(term, z), (a + n - 1) / ((b + n - 1) * n));
    sum = jetAdd(sum, term);
    if (n > 24 && Math.hypot(...term.v) < 2e-15) break;
  }
  return sum;
}
function jetDiv(a, b) { return jetMul(a, jetInv(b)); }
function jetPowInt(a, n) { let result = jet(cj(1)); for (let i = 0; i < n; i += 1) result = jetMul(result, a); return result; }

function hertzTEFromScalar(scalar) {
  const e = [scalar.h[0][2], scalar.h[1][2], cjScale(cjAdd(scalar.h[0][0], scalar.h[1][1]), -1)];
  const b = [scalar.h[1][3], cjScale(scalar.h[0][3], -1), cj(0)];
  return { ex: e[0][0], ey: e[1][0], ez: e[2][0], bx: b[0][0], by: b[1][0], bz: b[2][0] };
}
function supertoroidalHertzLift(scalar) {
  // Here the vector Hertz potential is Pi = curl(z_hat f), as in this family.
  // □f=0 reduces the third-order electric derivatives to spatial-time terms.
  const e = [cjScale(scalar.t[1][3][3], -1), scalar.t[0][3][3], cj(0)];
  const b = [scalar.t[0][2][3], scalar.t[1][2][3], cjScale(cjAdd(scalar.t[0][0][3], scalar.t[1][1][3]), -1)];
  return { ex: e[0][0], ey: e[1][0], ez: e[2][0], bx: b[0][0], by: b[1][0], bz: b[2][0] };
}

function complexSourceField(x, y, z) {
  // Complex Coulomb potential with z shifted by i*a; omit its ring singularity.
  const a = 0.9, q = [x * x + y * y + z * z - a * a, -2 * a * z];
  const qMagnitude = Math.hypot(q[0], q[1]);
  if (qMagnitude < 0.05) return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0 };
  const rootImaginarySign = q[1] < 0 ? -1 : 1;
  const root = [Math.sqrt(Math.max(0, (qMagnitude + q[0]) / 2)), rootImaginarySign * Math.sqrt(Math.max(0, (qMagnitude - q[0]) / 2))];
  const inverseCube = complexInverse(complexPower(root, 3));
  const components = [complexMul([x, 0], inverseCube), complexMul([y, 0], inverseCube), complexMul([z, -a], inverseCube)];
  return { ex: components[0][0], ey: components[1][0], ez: components[2][0], bx: components[0][1], by: components[1][1], bz: components[2][1] };
}

function scalarPulse(model, x, y, z, t) {
  const X = jet(cj(x), 0), Y = jet(cj(y), 1), Z = jet(cj(z), 2), T = jet(cj(t), 3);
  const I = jet(cj(0, 1));
  const rho2 = jetAdd(jetMul(X, X), jetMul(Y, Y));
  if (model === "focus-wave") {
    const beta = 0.72, z0 = 1.35;
    const denom = jetAdd(jet(cj(z0)), jetMul(I, jetAdd(Z, jetScale(T, -1))));
    const phase = jetAdd(jetScale(jetAdd(Z, T), beta), jetScale(jetDiv(rho2, denom), -beta));
    return jetDiv(jetExp(jetMul(I, phase)), jetScale(jetMul(I, denom), 4 * Math.PI));
  }
  const tau = jetAdd(Z, jetScale(T, -1));
  const sigma = jetAdd(Z, T);
  const q1 = 1.4, q2 = 1.0;
  const q = jetAdd(jet(cj(q1)), jetMul(I, tau));
  const s = jetAdd(jetDiv(rho2, q), jetScale(jetMul(I, sigma), -1));
  const sPlus = jetAdd(s, jet(cj(q2)));
  if (model === "focused-doughnut") return jetDiv(jet(cj(1)), jetMul(q, sPlus));
  const q3 = 1.1;
  return jetDiv(jetMul(jetDiv(jet(cj(q1)), q), jetExp(jetScale(s, -1 / q3))), jetPowInt(sPlus, 2));
}

function weberScalar(x, z, t) {
  // Exact separated Helmholtz mode at a=0. 1F1 is evaluated by its
  // convergent entire power series, with derivatives carried by the jets.
  const X = jet(cj(x), 0), Z = jet(cj(z), 2), T = jet(cj(t), 3), I = jet(cj(0, 1));
  if (Math.hypot(x, z) < 1e-5) return jet(cj(0));
  const parabolic = jetSqrt(jetScale(jetAdd(X, jetMul(I, Z)), 2));
  const eta = jetPart(parabolic, 0), xi = jetPart(parabolic, 1), sigma = Math.SQRT2;
  const p = s => {
    const scaled = jetScale(s, sigma), square = jetPowInt(scaled, 2);
    const phase = jetScale(square, -0.25);
    const arg = jetScale(jetMul(I, square), 0.5);
    const common = jetExp(jetMul(I, phase));
    const p0 = jetMul(common, jetHypergeometric1F1(0.25, 0.5, arg));
    const p1 = jetMul(jetMul(scaled, common), jetHypergeometric1F1(0.75, 1.5, arg));
    return [p0, p1];
  };
  const [p0x, p1x] = p(xi), [p0e, p1e] = p(eta);
  const gammaQuarterSquared = 13.1450571459, gammaThreeQuarterSquared = 1.5016460945;
  const transverse = jetScale(jetAdd(
    jetScale(jetMul(p0x, p0e), gammaQuarterSquared),
    jetScale(jetMul(I, jetMul(p1x, p1e)), 2 * gammaThreeQuarterSquared),
  ), 1 / (2 * Math.PI));
  return jetMul(transverse, jetExp(jetScale(jetMul(I, T), -1)));
}

function whittakerExponentialField(x, y, z, t) {
  // m=0 exact Whittaker scalar beam: chi = exp(i qz z - qz s)/(qz s).
  const X = jet(cj(x), 0), Y = jet(cj(y), 1), Z = jet(cj(z), 2), T = jet(cj(t), 3);
  const I = jet(cj(0, 1)), qz = 0.9, tau = 1.2;
  const rhoSquared = jetAdd(jetMul(X, X), jetMul(Y, Y));
  const retarded = jetAdd(T, jet(cj(0, -tau)));
  const s = jetSqrt(jetAdd(rhoSquared, jetScale(jetPowInt(retarded, 2), -1)));
  const qzS = jetScale(s, qz);
  const chi = jetDiv(jetExp(jetAdd(jetMul(I, jetScale(Z, qz)), jetScale(s, -qz))), qzS);
  const Fx = { v: cjAdd(chi.h[0][2], cjMul(I.v, chi.h[1][3])) };
  const Fy = { v: cjAdd(chi.h[1][2], cjScale(cjMul(I.v, chi.h[0][3]), -1)) };
  const Fz = { v: cjScale(cjAdd(chi.h[0][0], chi.h[1][1]), -1) };
  return { ex: Fx.v[0], ey: Fy.v[0], ez: Fz.v[0], bx: Fx.v[1], by: Fy.v[1], bz: Fz.v[1] };
}

function elegantLGScalar(x, y, z, t) {
  // Fundamental p=0,m=0 nonparaxial eLG mode: exp(-k a) j0(k R~),
  // where R~²=x²+y²+(z+i a)². Evaluate j0 as an entire series so the
  // complex-source ring never introduces a square-root branch singularity.
  const X = jet(cj(x), 0), Y = jet(cj(y), 1), Z = jet(cj(z), 2), T = jet(cj(t), 3);
  const I = jet(cj(0, 1)), k = 1, a = 1.15;
  const shiftedZ = jetAdd(Z, jetScale(I, a));
  const radiusSquared = jetAdd(jetAdd(jetMul(X, X), jetMul(Y, Y)), jetMul(shiftedZ, shiftedZ));
  const qSquared = jetScale(radiusSquared, k * k);
  let sum = jet(cj(1)), term = jet(cj(1));
  for (let n = 1; n <= 48; n += 1) {
    term = jetScale(jetMul(term, qSquared), -1 / ((2 * n) * (2 * n + 1)));
    sum = jetAdd(sum, term);
    if (n > 24 && Math.hypot(...term.v) < 1e-15) break;
  }
  return jetScale(jetMul(sum, jetExp(jetScale(jetMul(I, T), -k))), Math.exp(-k * a));
}

function acceleratingBesselScalar(x, y, z, t) {
  // Exact circular-coordinate Helmholtz mode J1(kxz r)e^(i theta), with
  // a plane-wave factor in y. The latter keeps the sample fully 3D while
  // kxz² + ky² = omega² (c=1).
  const X = jet(cj(x), 0), Y = jet(cj(y), 1), Z = jet(cj(z), 2), T = jet(cj(t), 3);
  const I = jet(cj(0, 1)), omega = 1.2, ky = 0.3, kxz = Math.sqrt(omega * omega - ky * ky);
  const radiusSquared = jetAdd(jetMul(X, X), jetMul(Z, Z));
  let radialSeries = jet(cj(1)), term = jet(cj(1));
  for (let n = 1; n <= 36; n += 1) {
    term = jetScale(jetMul(term, radiusSquared), -(kxz * kxz) / (4 * n * (n + 1)));
    radialSeries = jetAdd(radialSeries, term);
    if (n > 18 && Math.hypot(...term.v) < 1e-15) break;
  }
  const circularVortex = jetMul(jetAdd(X, jetMul(I, Z)), jetScale(radialSeries, kxz / 2));
  const phase = jetAdd(jetScale(Y, ky), jetScale(T, -omega));
  return jetMul(circularVortex, jetExp(jetMul(I, phase)));
}

function rindlerBesselK(order, argument) {
  // K_(i order)(x) = integral exp(-x cosh u) cos(order*u) du.
  // The derivative is with respect to x. Simpson quadrature evaluates the
  // exact special-function representation without an external runtime.
  const panels = 96, upper = 8, step = upper / panels;
  let value = 0, derivative = 0;
  for (let i = 0; i <= panels; i += 1) {
    const u = i * step, ch = Math.cosh(u), weight = i === 0 || i === panels ? 1 : i % 2 ? 4 : 2;
    const term = Math.exp(-argument * ch) * Math.cos(order * u) * weight;
    value += term;
    derivative -= ch * term;
  }
  return { value: value * step / 3, derivative: derivative * step / 3 };
}

function rindlerTEField(x, y, z, t) {
  // Exact TE mode from Hacyan (2011), Eqs. (2.14)-(2.17), with
  // a=kx=1, ky=0, Omega=0.8. Convert Rindler (T,Z) to Minkowski (t,z).
  const a = 1, k = 1, omega = 0.8;
  const zSquared = z * z - t * t;
  if (z <= Math.abs(t) || zSquared < 0.16) return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0 };
  const Z = Math.sqrt(zSquared), aT = Math.atanh(t / z), { value: K, derivative: Kp } = rindlerBesselK(omega / a, k * Z);
  const phase = k * x - omega * aT / a, cp = Math.cos(phase), sp = Math.sin(phase);
  const F = [omega / (a * Z) * Math.sinh(aT) * K, -k * Math.cosh(aT) * Kp];
  const G = [omega / (a * Z) * Math.cosh(aT) * K, -k * Math.sinh(aT) * Kp];
  // Re[e^(i phase) times the source's complex phasor components].
  return {
    ex: 0,
    ey: k * (G[0] * cp - G[1] * sp),
    ez: 0,
    bx: -k * (F[0] * cp - F[1] * sp),
    by: 0,
    bz: k * k * K * cp,
  };
}

function solutionField(id, x, y, z, t) {
  const model = SAMPLE_MODELS[id] ?? id;
  if (model === "plane") {
    const u = z - t, phase = 1.8 * u, envelope = Math.exp(-(u * u) / (2 * 1.35 * 1.35));
    return { ex: envelope * Math.cos(phase), ey: -envelope * Math.sin(phase), ez: 0, bx: envelope * Math.sin(phase), by: envelope * Math.cos(phase), bz: 0 };
  }
  if (model === "bessel") {
    const kappa = 1.1, kz = 1.1, omega = Math.hypot(kappa, kz);
    const rho = Math.hypot(x, y), phase = kz * z - omega * t;
    const er = kz * kappa * besselJ1(kappa * rho) * Math.sin(phase);
    const ez = kappa * kappa * besselJ0(kappa * rho) * Math.cos(phase);
    const bphi = omega * kappa * besselJ1(kappa * rho) * Math.sin(phase);
    const invRho = rho > 1e-9 ? 1 / rho : 0;
    return { ex: er * x * invRho, ey: er * y * invRho, ez, bx: -bphi * y * invRho, by: bphi * x * invRho, bz: 0 };
  }
  if (model === "xwave-finite-spectrum") {
    // A finite conical spectrum: each term is an exact Bessel Maxwell mode,
    // and all share kz/omega = 1/v so the packet peak travels at fixed v.
    const v = 1.35, rho = Math.hypot(x, y), invRho = rho > 1e-9 ? 1 / rho : 0;
    const frequencies = [0.55, 0.95, 1.35];
    let ex = 0, ey = 0, ez = 0, bx = 0, by = 0;
    for (const omega of frequencies) {
      const kz = omega / v, kappa = omega * Math.sqrt(1 - 1 / (v * v));
      const phase = kz * z - omega * t;
      const er = kz * kappa * besselJ1(kappa * rho) * Math.sin(phase);
      const longitudinal = kappa * kappa * besselJ0(kappa * rho) * Math.cos(phase);
      const bphi = omega * kappa * besselJ1(kappa * rho) * Math.sin(phase);
      ex += er * x * invRho; ey += er * y * invRho; ez += longitudinal;
      bx -= bphi * y * invRho; by += bphi * x * invRho;
    }
    return { ex, ey, ez, bx, by, bz: 0 };
  }
  if (model === "flying-focus") {
    // Lorentz transform of an exact complex-source Maxwell field. The source
    // centre moves at v along +z, so its localized intensity peak follows it.
    const velocity = 0.65, gamma = 1 / Math.sqrt(1 - velocity * velocity);
    const rest = complexSourceField(x, y, gamma * (z - velocity * t));
    return {
      ex: gamma * (rest.ex + velocity * rest.by), ey: gamma * (rest.ey - velocity * rest.bx), ez: rest.ez,
      bx: gamma * (rest.bx - velocity * rest.ey), by: gamma * (rest.by + velocity * rest.ex), bz: rest.bz,
    };
  }
  if (["focus-wave", "focused-doughnut", "supertoroidal"].includes(model)) {
    const scalar = scalarPulse(model, x, y, z, t);
    return model === "supertoroidal" ? supertoroidalHertzLift(scalar) : hertzTEFromScalar(scalar);
  }
  if (model === "weber") return hertzTEFromScalar(weberScalar(x, z, t));
  if (model === "whittaker-exponential") return whittakerExponentialField(x, y, z, t);
  if (model === "rindler-te") return rindlerTEField(x, y, z, t);
  if (model === "elegant-lg-fundamental") return hertzTEFromScalar(elegantLGScalar(x, y, z, t));
  if (model === "accelerating-bessel") return hertzTEFromScalar(acceleratingBesselScalar(x, y, z, t));
  if (model === "dipole") {
    const r = Math.hypot(x, y, z);
    if (r < 0.48) return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0 };
    const nx = x / r, ny = y / r, nz = z / r, retarded = t - r;
    const p = Math.cos(retarded), pDot = -Math.sin(retarded), pDoubleDot = -Math.cos(retarded);
    const near = p / (r * r * r) + pDot / (r * r);
    const radial = 3 * nz * near;
    const radiation = pDoubleDot / r;
    const ex = radial * nx + radiation * nx * nz;
    const ey = radial * ny + radiation * ny * nz;
    const ez = (3 * nz * nz - 1) * near + (nz * nz - 1) * radiation;
    const magnetic = pDot / (r * r) + pDoubleDot / r;
    return { ex, ey, ez, bx: -ny * magnetic, by: nx * magnetic, bz: 0 };
  }

  if (model === "coulomb") {
    const r = Math.hypot(x, y, z);
    if (r < 0.42) return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0 };
    const scale = 1 / (r * r * r);
    return { ex: x * scale, ey: y * scale, ez: z * scale, bx: 0, by: 0, bz: 0 };
  }

  if (model === "uniform") return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 1 };

  if (model === "uniform-electric") return { ex: 1, ey: 0, ez: 0, bx: 0, by: 0, bz: 0.65 };

  if (model === "harmonic-static") {
    // Phi = x^2 + y^2 - 2z^2 is harmonic; E = -grad(Phi), B = 0.
    return { ex: -2 * x, ey: -2 * y, ez: 4 * z, bx: 0, by: 0, bz: 0 };
  }

  if (model === "evanescent") {
    // k=(i*kappa,0,kz), k^2=omega^2 and k·E=0 for the TE polarization.
    const kappa = 0.6, kz = 1, omega = Math.sqrt(kz * kz - kappa * kappa);
    const phase = kz * z - omega * t, amplitude = Math.exp(-kappa * x);
    return {
      ex: 0, ey: amplitude * Math.cos(phase), ez: 0,
      bx: -kz / omega * amplitude * Math.cos(phase), by: 0,
      bz: -kappa / omega * amplitude * Math.sin(phase),
    };
  }

  if (model === "spherical") {
    // Regular l=1 TE mode from A = curl(z_hat * j0(kr) cos(omega*t+phase)).
    const k = 1.2, omega = k, r = Math.hypot(x, y, z), temporalPhase = omega * t + Math.PI / 3;
    let radialSlope, hessianCorrection;
    if (r < 1e-4) {
      radialSlope = -k * k / 3 + (k ** 4 * r * r) / 30;
      hessianCorrection = (k ** 4 * r * r) / 15;
    } else {
      const u = k * r, sin = Math.sin(u), cos = Math.cos(u);
      const first = k * (u * cos - sin) / (u * u);
      const second = k * k * ((2 - u * u) * sin - 2 * u * cos) / (u * u * u);
      radialSlope = first / r;
      hessianCorrection = second - radialSlope;
    }
    const electricScale = omega * Math.sin(temporalPhase) * radialSlope;
    const magneticScale = Math.cos(temporalPhase);
    return {
      ex: electricScale * y, ey: -electricScale * x, ez: 0,
      bx: magneticScale * hessianCorrection * x * z,
      by: magneticScale * hessianCorrection * y * z,
      bz: -magneticScale * (2 * radialSlope + hessianCorrection * (x * x + y * y)),
    };
  }

  if (model === "rn") {
    // Local orthonormal fields of a dyonic RN member; omit the interior of its horizon.
    const mass = 1, electricCharge = 0.7, magneticCharge = 0.2;
    const horizon = mass + Math.sqrt(mass * mass - electricCharge * electricCharge - magneticCharge * magneticCharge);
    const r = Math.hypot(x, y, z);
    if (r <= horizon * 1.015) return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0 };
    const scale = 1 / (r * r * r);
    return { ex: electricCharge * x * scale, ey: electricCharge * y * scale, ez: electricCharge * z * scale, bx: magneticCharge * x * scale, by: magneticCharge * y * scale, bz: magneticCharge * z * scale };
  }

  if (model === "wald") {
    // Schwarzschild member (a=0) of the Wald test field, in a static orthonormal frame.
    const mass = 0.65, r = Math.hypot(x, y, z), rho = Math.hypot(x, y);
    if (r <= 2 * mass) return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0 };
    const sinTheta = rho / r, cosTheta = z / r, redshift = Math.sqrt(1 - 2 * mass / r);
    const radial = cosTheta;
    const polar = -redshift * sinTheta;
    const ex = rho > 1e-9 ? x / rho : 0, ey = rho > 1e-9 ? y / rho : 0;
    return { ex: 0, ey: 0, ez: 0, bx: radial * sinTheta * ex + polar * cosTheta * ex, by: radial * sinTheta * ey + polar * cosTheta * ey, bz: radial * cosTheta - polar * sinTheta };
  }

  if (model === "melvin") {
    // B measured in the static orthonormal frame for A_phi=B0*rho^2/(2 Lambda).
    const b0 = 1, lambda = 1 + b0 * b0 * (x * x + y * y) / 4;
    return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: b0 / (lambda * lambda) };
  }

  if (model === "br") return { ex: 0, ey: 0, ez: 1, bx: 0, by: 0, bz: 0 };

  if (model === "mp") {
    // One-centre MP in isotropic radius rho; the orthonormal field is M/(rho+M)^2.
    const mass = 1, rho = Math.hypot(x, y, z);
    if (rho < 0.12) return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0 };
    const scale = mass / ((rho + mass) * (rho + mass) * rho);
    return { ex: x * scale, ey: y * scale, ez: z * scale, bx: 0, by: 0, bz: 0 };
  }

  if (model === "complex-source") return complexSourceField(x, y, z);

  // Catalogued families without a validated sample model are reference-only.
  if (model !== "hopfion") {
    return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0 };
  }

  // Kedia et al.'s Hopfion in dimensionless c=1 coordinates; F = E + iB.
  const a = [x, -y], b = [t - z, -1];
  const d = [x * x + y * y + z * z - t * t + 1, 2 * t];
  const dInv3 = complexPower(complexInverse(d), 3);
  const a2 = complexPower(a, 2), b2 = complexPower(b, 2), ab = complexMul(a, b);
  const components = [
    complexMul(dInv3, complexSub(b2, a2)),
    complexMul(dInv3, [complexMul([0, -1], complexAdd(a2, b2))[0], complexMul([0, -1], complexAdd(a2, b2))[1]]),
    complexMul(dInv3, complexScale(ab, 2)),
  ];
  return { ex: components[0][0], ey: components[1][0], ez: components[2][0], bx: components[0][1], by: components[1][1], bz: components[2][1] };
}

function fieldRows(id, time, resolution) {
  const rows = [];
  let index = 0;
  for (let ix = 0; ix < resolution; ix += 1) {
    const x = -RANGE + 2 * RANGE * ix / (resolution - 1);
    for (let iy = 0; iy < resolution; iy += 1) {
      const y = -RANGE + 2 * RANGE * iy / (resolution - 1);
      for (let iz = 0; iz < resolution; iz += 1) {
        const z = -RANGE + 2 * RANGE * iz / (resolution - 1);
        const f = solutionField(id, x, y, z, time);
        rows.push({ id: `field-${index}`, label: `Sample ${index + 1}`, x, y, z, ex: f.ex, ey: f.ey, ez: f.ez, bx: f.bx, by: f.by, bz: f.bz });
        index += 1;
      }
    }
  }
  return rows;
}

function magnitudeRows(rows, component) {
  const prefix = component === "electric" ? "e" : "b";
  const magnitudes = rows.map(row => Math.hypot(row[`${prefix}x`], row[`${prefix}y`], row[`${prefix}z`]));
  const peak = Math.max(...magnitudes, 1e-12);
  return rows.map((row, index) => ({
    ...row,
    value: magnitudes[index] / peak,
    u: row[`${prefix}x`], v: row[`${prefix}y`], w: row[`${prefix}z`],
  }));
}

function hasCurvedReference(id) {
  return CURVED_REFERENCES.has(id);
}

function hasSampledField(id) {
  return SAMPLED_FIELDS.has(id);
}

function isTimeDependent(id) {
  return ["plane", "bessel", "dipole", "hopfion", "evanescent", "spherical", "focus-wave", "focused-doughnut", "supertoroidal", "xwave-finite-spectrum", "flying-focus", "weber", "whittaker-exponential", "rindler-te", "elegant-lg-fundamental", "accelerating-bessel"].includes(SAMPLE_MODELS[id] ?? id);
}

function isReferenceOnly(id) {
  return !hasSampledField(id);
}

function hasSpatialMagnitudeVariation(id) {
  return hasSampledField(id) && !["uniform", "uniform-electric", "br"].includes(SAMPLE_MODELS[id] ?? id);
}

function hasComponentMagnitudeVariation(id, component) {
  if (!hasSpatialMagnitudeVariation(id)) return false;
  const model = SAMPLE_MODELS[id] ?? id;
  if (model === "coulomb") return component === "electric";
  if (model === "mp") return component === "electric";
  if (model === "harmonic-static") return component === "electric";
  if (model === "melvin") return component === "magnetic";
  if (model === "wald") return component === "magnetic";
  return true;
}

function componentRows(rows, component, positionOffset = [0, 0, 0]) {
  const prefix = component === "electric" ? "e" : "b";
  return rows.map(row => ({ ...row, u: row[`${prefix}x`], v: row[`${prefix}y`], w: row[`${prefix}z`], vectorPositionOffset: positionOffset }));
}

function updateLegend() {
  const solution = SOLUTIONS.find(item => item.id === state.solution);
  const curvedReference = hasCurvedReference(solution.id);
  const referenceOnly = isReferenceOnly(solution.id);
  const time = state.time.toFixed(2);
  $("#time-value").textContent = time;
  $("#time-slider").value = String(state.time);
  $("#time-readout").textContent = `t = ${time}`;
  const timeNote = $("#time-slider").closest(".control-section").querySelector(".field-note");
  timeNote.textContent = isTimeDependent(solution.id)
    ? "Units use c = 1. Move the slider to inspect successive spatial slices of this time-dependent field."
    : "Static field preview: time is fixed at t = 0; use the spatial and isosurface controls to inspect it.";
  $("#legend-title").textContent = `${solution.name.toUpperCase()} · t = ${time}`;
  $("#legend-electric").hidden = !state.electric;
  $("#legend-magnetic").hidden = !state.magnetic;
  $("#stage-heading").textContent = solution.name.toUpperCase();
  $("#stage-subheading").textContent = solution.subheading;
  $("#solution-kind").textContent = solution.kind;
  $("#solution-title").textContent = solution.heading;
  $("#solution-description").textContent = solution.description;
  $("#equation").textContent = solution.equation;
  $("#solution-caveat").textContent = solution.caveat;
  $("#source-link").href = solution.source;
  $("#legend-meta").textContent = referenceOnly
    ? curvedReference ? "CURVED REFERENCE · METRIC RENDERING UNAVAILABLE" : "SYMBOLIC FAMILY · LIVE PREVIEW NOT AVAILABLE"
    : curvedReference ? "CURVED FIELD · LOCAL SAMPLE · METRIC NOT DRAWN" : "x, y, z at fixed t · normalized field display";
  $("#iso-note").textContent = referenceOnly
    ? "No live field preview is available for this entry yet; its formulas and sources are shown below. Choose a catalog entry marked LIVE FIELD to inspect vectors and isosurfaces."
    : !hasSpatialMagnitudeVariation(solution.id)
      ? "This exact sample has spatially constant field magnitude, so no magnitude isosurface exists. Vector controls remain available."
      : SAMPLE_DESCRIPTIONS[solution.id]
        ? `Live preview: ${SAMPLE_DESCRIPTIONS[solution.id]}. ${curvedReference ? "The field is shown in a local orthonormal frame; spacetime curvature is not drawn. " : ""}Available component surfaces can be configured independently; unsupported components stay disabled. Multiple nested wireframes turns off the solid shell; its surface count is set below. ConeIso aligns cones with the field; set tube radius to 0 for flat wires.`
      : "Available E and B surfaces can be configured independently. Multiple nested wireframes turns off the solid shell; its surface count is set below. ConeIso places field-aligned cones on shell facets; set tube radius to 0 for flat wire lines.";
  const electricIsoAvailable = hasComponentMagnitudeVariation(solution.id, "electric");
  const magneticIsoAvailable = hasComponentMagnitudeVariation(solution.id, "magnetic");
  const isoAvailable = electricIsoAvailable || magneticIsoAvailable;
  $("#show-isosurfaces").disabled = !isoAvailable;
  $("#show-electric-isosurface").disabled = !electricIsoAvailable;
  $("#show-magnetic-isosurface").disabled = !magneticIsoAvailable;
  $("#show-cone-iso").disabled = !isoAvailable;
  $("#cone-iso-size").disabled = !isoAvailable;
  $("#iso-threshold").disabled = !isoAvailable;
  $("#iso-solid").disabled = !isoAvailable;
  $("#iso-wireframe").disabled = !isoAvailable;
  $("#iso-multiple").disabled = !isoAvailable;
  $("#iso-count").disabled = !isoAvailable || $("#iso-solid").checked || !$("#iso-multiple").checked;
  $("#iso-resolution").disabled = !isoAvailable;
  $("#iso-radius").disabled = !isoAvailable;
  $("#time-slider").disabled = referenceOnly || !isTimeDependent(solution.id);
  $("#play-toggle").disabled = referenceOnly || !state.controller || !isTimeDependent(solution.id);
  $("#reset-time").disabled = referenceOnly;
  $("#density").disabled = referenceOnly;
  if (referenceOnly) {
    $("#status-text").textContent = curvedReference ? "CURVED FIELD · REFERENCE ENTRY" : "ANALYTIC FAMILY · REFERENCE ENTRY";
    $("#status-dot").className = "status-dot ready";
  } else {
    $("#status-text").textContent = "SPACETIME SLICE READY";
    $("#status-dot").className = "status-dot ready";
  }
}

function makeFieldPlotter() {
  return Object.freeze({
    capabilities: ["time", "animation", "layers", "thresholds", "tubeRadius", "surfaceCount"],
    create(context, _definition, initial) {
      const { THREE, scene } = context;
      const axes = context.resources.track(new THREE.AxesHelper(2.8));
      axes.name = "spatial-coordinate-axes";
      scene.add(axes);
      const vectorOptions = {
        maximumHeight: 0.24,
        magnitudeExponent: 0.35,
        positionOffset: row => row.vectorPositionOffset,
        positionBounds: [[-2.5, 2.5], [-2.5, 2.5], [-2.5, 2.5]],
      };
      const electricGroup = new THREE.Group();
      const magneticGroup = new THREE.Group();
      const electricVectorGroup = new THREE.Group();
      const magneticVectorGroup = new THREE.Group();
      const electricIsoGroup = new THREE.Group();
      const magneticIsoGroup = new THREE.Group();
      const electricConeIsoGroup = new THREE.Group();
      const magneticConeIsoGroup = new THREE.Group();
      electricGroup.name = "electric-field-layer";
      magneticGroup.name = "magnetic-field-layer";
      electricIsoGroup.name = "electric-isosurfaces";
      magneticIsoGroup.name = "magnetic-isosurfaces";
      electricConeIsoGroup.name = "electric-cone-isosurfaces";
      magneticConeIsoGroup.name = "magnetic-cone-isosurfaces";
      electricGroup.add(electricVectorGroup);
      magneticGroup.add(magneticVectorGroup);
      scene.add(electricGroup, magneticGroup, electricIsoGroup, magneticIsoGroup, electricConeIsoGroup, magneticConeIsoGroup);
      const electric = makeVectorPlotter({ x: "x", y: "y", z: "z", u: "u", v: "v", w: "w" }, 0.24, { ...vectorOptions, color: COLORS.electric });
      const magnetic = makeVectorPlotter({ x: "x", y: "y", z: "z", u: "u", v: "v", w: "w" }, 0.24, { ...vectorOptions, color: COLORS.magnetic });
      const ePlot = electric.create({ ...context, scene: electricVectorGroup }, { configuration: {} }, componentRows(initial.rows, "electric"));
      const bPlot = magnetic.create({ ...context, scene: magneticVectorGroup }, { configuration: {} }, componentRows(initial.rows, "magnetic"));
      const isoMapping = { x: "x", y: "y", z: "z", value: "value" };
      const isoInitialRows = fieldRows("dipole", initial.time, state.surfaceResolution);
      const eIsoPlot = makeIsosurfacePlotter(isoMapping, { ...ISO_OPTIONS, color: COLORS.electric, wireframeColor: COLORS.electric })
        .create({ ...context, scene: electricIsoGroup }, { configuration: {} }, magnitudeRows(isoInitialRows, "electric"));
      const bIsoPlot = makeIsosurfacePlotter(isoMapping, { ...ISO_OPTIONS, color: COLORS.magnetic, wireframeColor: COLORS.magnetic })
        .create({ ...context, scene: magneticIsoGroup }, { configuration: {} }, magnitudeRows(isoInitialRows, "magnetic"));
      const vectorMapping = { x: "x", y: "y", z: "z", u: "u", v: "v", w: "w" };
      const eConeIsoPlot = makeConeIsoPlotter(isoMapping, vectorMapping, { ...CONE_ISO_OPTIONS, color: COLORS.electric })
        .create({ ...context, scene: electricConeIsoGroup }, { configuration: {} }, magnitudeRows(isoInitialRows, "electric"));
      const bConeIsoPlot = makeConeIsoPlotter(isoMapping, vectorMapping, { ...CONE_ISO_OPTIONS, color: COLORS.magnetic })
        .create({ ...context, scene: magneticConeIsoGroup }, { configuration: {} }, magnitudeRows(isoInitialRows, "magnetic"));
      let rows = initial.rows;
      let activeTime = initial.time;
      let elapsed = 0;
      let surfaceElapsed = 0;
      const updateConeIsoCount = () => {
        if (!hasComponentMagnitudeVariation(state.solution, "electric") && !hasComponentMagnitudeVariation(state.solution, "magnetic")) {
          $("#cone-iso-count").textContent = "This entry has no spatially varying sampled field.";
          return;
        }
        if (!state.coneIso) {
          $("#cone-iso-count").textContent = "Enable ConeIso to see its cone count.";
          return;
        }
        const electricCount = state.electricSurface && hasComponentMagnitudeVariation(state.solution, "electric") ? (eConeIsoPlot.report?.count ?? 0) : 0;
        const magneticCount = state.magneticSurface && hasComponentMagnitudeVariation(state.solution, "magnetic") ? (bConeIsoPlot.report?.count ?? 0) : 0;
        $("#cone-iso-count").textContent = `ConeIso cones · E ${electricCount.toLocaleString()} · B ${magneticCount.toLocaleString()}`;
      };
      const updateSurfaceVisibility = () => {
        const electricAvailable = hasComponentMagnitudeVariation(state.solution, "electric");
        const magneticAvailable = hasComponentMagnitudeVariation(state.solution, "magnetic");
        electricIsoGroup.visible = electricAvailable && state.isosurfaces && state.electricSurface;
        magneticIsoGroup.visible = magneticAvailable && state.isosurfaces && state.magneticSurface;
        electricConeIsoGroup.visible = electricAvailable && state.isosurfaces && state.coneIso && state.electricSurface;
        magneticConeIsoGroup.visible = magneticAvailable && state.isosurfaces && state.coneIso && state.magneticSurface;
      };
      const refresh = (refreshSurfaces = true) => {
        rows = fieldRows(state.solution, activeTime, state.resolution);
        const radialDyonicSample = (SAMPLE_MODELS[state.solution] ?? state.solution) === "rn";
        const separation = radialDyonicSample ? 0.055 : 0;
        ePlot.update(componentRows(rows, "electric", [-separation, 0, 0]));
        bPlot.update(componentRows(rows, "magnetic", [separation, 0, 0]));
        updateSurfaceVisibility();
        if (refreshSurfaces && hasSampledField(state.solution)) {
          const surfaceRows = fieldRows(state.solution, activeTime, state.surfaceResolution);
          const electricRows = magnitudeRows(surfaceRows, "electric");
          const magneticRows = magnitudeRows(surfaceRows, "magnetic");
          try { eIsoPlot.update(electricRows); } catch { /* some exact fields have no shell at the selected level */ }
          try { bIsoPlot.update(magneticRows); } catch { /* some exact fields have no shell at the selected level */ }
          if (state.coneIso) {
            try { eConeIsoPlot.update(electricRows); } catch { /* no electric facet at the selected level */ }
            try { bConeIsoPlot.update(magneticRows); } catch { /* no magnetic facet at the selected level */ }
          }
          updateConeIsoCount();
        }
        context.requestRender();
      };
      electricGroup.visible = state.electric;
      magneticGroup.visible = state.magnetic;
      updateSurfaceVisibility();
      return {
        capabilities: ["time", "animation", "layers", "thresholds", "tubeRadius", "surfaceCount"],
        update(next) {
          if (next.solution) state.solution = next.solution;
          if (Number.isFinite(next.time)) activeTime = next.time;
          if (Number.isFinite(next.resolution)) state.resolution = next.resolution;
          if (Number.isFinite(next.surfaceResolution)) state.surfaceResolution = next.surfaceResolution;
          refresh();
        },
        setTime(value) {
          const next = Number(value);
          if (!Number.isFinite(next)) throw new Error("Time coordinate must be finite.");
          activeTime = next;
          state.time = next;
          refresh();
        },
        setLayerVisible(id, visible) {
          if (id === "electric") { state.electric = Boolean(visible); electricGroup.visible = state.electric; }
          if (id === "magnetic") { state.magnetic = Boolean(visible); magneticGroup.visible = state.magnetic; }
          if (id === "isosurfaces") { state.isosurfaces = Boolean(visible); updateSurfaceVisibility(); }
          if (id === "electric-isosurface") { state.electricSurface = Boolean(visible); updateSurfaceVisibility(); updateConeIsoCount(); }
          if (id === "magnetic-isosurface") { state.magneticSurface = Boolean(visible); updateSurfaceVisibility(); updateConeIsoCount(); }
          if (id === "coneIso") {
            state.coneIso = Boolean(visible);
            if (state.coneIso && hasSampledField(state.solution)) {
              const surfaceRows = fieldRows(state.solution, activeTime, state.surfaceResolution);
              try {
                eConeIsoPlot.update(magnitudeRows(surfaceRows, "electric"));
                eConeIsoPlot.setThreshold(state.threshold);
                eConeIsoPlot.setSurfaceCount(state.surfaceCount);
                eConeIsoPlot.setMaximumHeight(state.coneIsoSize);
                eConeIsoPlot.setLayerVisible("multiple", state.nested);
              } catch { /* no valid electric facets at the current threshold */ }
              try {
                bConeIsoPlot.update(magnitudeRows(surfaceRows, "magnetic"));
                bConeIsoPlot.setThreshold(state.threshold);
                bConeIsoPlot.setSurfaceCount(state.surfaceCount);
                bConeIsoPlot.setMaximumHeight(state.coneIsoSize);
                bConeIsoPlot.setLayerVisible("multiple", state.nested);
              } catch { /* no valid magnetic facets at the current threshold */ }
            }
            updateSurfaceVisibility();
            updateConeIsoCount();
          }
          if (["surface", "wireframe", "multiple"].includes(id)) {
            for (const plot of [eIsoPlot, bIsoPlot]) {
              try { plot.setLayerVisible(id, visible); } catch { /* a constant component has no isosurface */ }
            }
            if (id === "multiple") {
              state.nested = Boolean(visible);
              if (state.coneIso) {
                for (const plot of [eConeIsoPlot, bConeIsoPlot]) {
                  try { plot.setLayerVisible(id, visible); } catch { /* a constant component has no ConeIso surface */ }
                }
              }
              updateConeIsoCount();
            }
          }
          context.requestRender();
        },
        setThreshold(value) {
          for (const plot of [eIsoPlot, bIsoPlot]) {
            try { plot.setThreshold(value); } catch { /* constant-magnitude components have no shell threshold */ }
          }
          if (state.coneIso) {
            for (const plot of [eConeIsoPlot, bConeIsoPlot]) {
              try { plot.setThreshold(value); } catch { /* no ConeIso facets at the selected threshold */ }
            }
          }
          state.threshold = Number(value);
          updateConeIsoCount();
        },
        setTubeRadius(value) { eIsoPlot.setTubeRadius(value); bIsoPlot.setTubeRadius(value); state.tubeRadius = Number(value); },
        setConeIsoSize(value) {
          state.coneIsoSize = Number(value);
          if (state.coneIso) { eConeIsoPlot.setMaximumHeight(value); bConeIsoPlot.setMaximumHeight(value); }
        },
        setSurfaceCount(value) {
          for (const plot of [eIsoPlot, bIsoPlot]) {
            try { plot.setSurfaceCount(value); } catch { /* a constant component has no isosurface */ }
          }
          if (state.coneIso) {
            for (const plot of [eConeIsoPlot, bConeIsoPlot]) {
              try { plot.setSurfaceCount(value); } catch { /* no ConeIso surface at the selected threshold */ }
            }
          }
          state.surfaceCount = Number(value);
          updateConeIsoCount();
        },
        updateFrame(frame) {
          elapsed += frame.deltaSeconds;
          if (elapsed < 0.08) return;
          const delta = elapsed; elapsed = 0;
          surfaceElapsed += delta;
          activeTime += delta * 0.7;
          if (activeTime > 6.28) activeTime = -6.28;
          state.time = activeTime;
          const refreshSurfaces = surfaceElapsed >= 0.35;
          if (refreshSurfaces) surfaceElapsed = 0;
          refresh(refreshSurfaces);
          updateLegend();
        },
        dispose() {
          scene.remove(axes);
          ePlot.dispose();
          bPlot.dispose();
          eIsoPlot.dispose();
          bIsoPlot.dispose();
          eConeIsoPlot.dispose();
          bConeIsoPlot.dispose();
          scene.remove(electricGroup, magneticGroup, electricIsoGroup, magneticIsoGroup, electricConeIsoGroup, magneticConeIsoGroup);
        },
      };
    },
  });
}

function renderSolutionList() {
  const list = $("#solution-list");
  const query = $("#solution-search").value.trim().toLocaleLowerCase();
  const matches = SOLUTIONS.filter(solution => !query || [solution.name, solution.short, solution.kind, solution.description, solution.equation].join(" ").toLocaleLowerCase().includes(query));
  const liveCount = matches.filter(solution => hasSampledField(solution.id)).length;
  $("#solution-count").textContent = query ? `${matches.length}/${SOLUTIONS.length} · ${liveCount} live` : `${SOLUTIONS.length} entries · ${liveCount} live`;
  const buttons = matches.map(solution => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "solution-button";
    button.dataset.solution = solution.id;
    button.setAttribute("aria-pressed", String(solution.id === state.solution));
    const badge = hasSampledField(solution.id) ? "LIVE FIELD" : "SYMBOLIC";
    button.innerHTML = `<span class="solution-symbol" aria-hidden="true">${solution.symbol}</span><span><strong>${solution.name}</strong><small>${solution.short}</small></span><span class="sample-badge ${hasSampledField(solution.id) ? "sampled" : "reference"}">${badge}</span>`;
    button.addEventListener("click", () => {
      if ((!hasSampledField(solution.id) || !isTimeDependent(solution.id)) && state.playing) {
        state.controller?.pause();
        state.playing = false;
        $("#play-toggle").textContent = "PLAY TIME";
        $("#play-toggle").setAttribute("aria-pressed", "false");
      }
      if (!isTimeDependent(solution.id)) {
        state.time = 0;
        state.controller?.setTime(0);
      }
      state.solution = solution.id;
      for (const item of list.querySelectorAll("button")) item.setAttribute("aria-pressed", String(item === button));
      state.controller?.update({ solution: state.solution, time: state.time, resolution: state.resolution });
      updateLegend();
    });
    return button;
  });
  if (!buttons.length) {
    const empty = document.createElement("p");
    empty.className = "solution-empty";
    empty.textContent = "No catalog entries match this search.";
    buttons.push(empty);
  }
  list.replaceChildren(...buttons);
}

async function start() {
  renderSolutionList();
  updateLegend();
  const initialRows = fieldRows(state.solution, state.time, state.resolution);
  try {
    state.controller = await mount($("#viewport"), {
      plotter: makeFieldPlotter(),
      data: { rows: initialRows, time: state.time },
      configuration: { backgroundColor: 0x202832, autoplay: false },
      renderer: { antialias: true, maxPixelRatio: 1.5, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMapping: "ACESFilmicToneMapping", toneMappingExposure: 1.08 },
      camera: { type: "perspective", position: [7.5, 6.1, 8.4], target: [0, 0, 0], fov: 42 },
      controls: { enabled: true, enableDamping: true, dampingFactor: 0.065, minDistance: 5, maxDistance: 22 },
      callbacks: { onError(error) { $("#status-text").textContent = "VIEW ERROR"; $("#status-dot").className = "status-dot error"; showError(error.message); } },
    });
    $("#loading").hidden = true;
    updateLegend();
  } catch (error) {
    $("#loading").hidden = true;
    $("#status-text").textContent = "VIEW FAILED";
    $("#status-dot").className = "status-dot error";
    showError(`${error.message} Check browser WebGL support and the pinned Three.js runtime connection.`);
  }
}

function showError(message) {
  const error = $("#error-message");
  error.hidden = !message;
  error.textContent = message;
}

$("#time-slider").addEventListener("input", event => {
  state.time = Number(event.target.value);
  state.controller?.setTime(state.time);
  updateLegend();
});
$("#solution-search").addEventListener("input", renderSolutionList);
$("#density").addEventListener("input", event => {
  state.resolution = Number(event.target.value);
  $("#density-value").textContent = `${state.resolution}³`;
  state.controller?.update({ solution: state.solution, time: state.time, resolution: state.resolution });
});
$("#iso-resolution").addEventListener("input", event => {
  state.surfaceResolution = Number(event.target.value);
  $("#iso-resolution-value").textContent = `${state.surfaceResolution}³`;
  state.controller?.update({ solution: state.solution, time: state.time, resolution: state.resolution, surfaceResolution: state.surfaceResolution });
});
$("#show-isosurfaces").addEventListener("change", event => state.controller?.setLayerVisible("isosurfaces", event.target.checked));
$("#show-electric-isosurface").addEventListener("change", event => state.controller?.setLayerVisible("electric-isosurface", event.target.checked));
$("#show-magnetic-isosurface").addEventListener("change", event => state.controller?.setLayerVisible("magnetic-isosurface", event.target.checked));
$("#show-cone-iso").addEventListener("change", event => state.controller?.setLayerVisible("coneIso", event.target.checked));
$("#cone-iso-size").addEventListener("input", event => {
  state.coneIsoSize = Number(event.target.value);
  $("#cone-iso-size-value").textContent = state.coneIsoSize.toFixed(2);
  state.controller?.setConeIsoSize(state.coneIsoSize);
});
$("#iso-threshold").addEventListener("input", event => {
  state.threshold = Number(event.target.value);
  $("#iso-threshold-value").textContent = state.threshold.toFixed(2);
  try { state.controller?.setThreshold(state.threshold); showError(""); }
  catch (error) { showError(error.message); }
});
$("#iso-solid").addEventListener("change", event => {
  if (event.target.checked) $("#iso-multiple").checked = false;
  $("#iso-count").disabled = event.target.checked || !$("#iso-multiple").checked;
  state.controller?.setLayerVisible("surface", event.target.checked);
  state.controller?.setLayerVisible("multiple", $("#iso-multiple").checked);
});
$("#iso-wireframe").addEventListener("change", event => state.controller?.setLayerVisible("wireframe", event.target.checked));
$("#iso-multiple").addEventListener("change", event => {
  if (event.target.checked) {
    $("#iso-solid").checked = false;
    state.controller?.setLayerVisible("surface", false);
  }
  $("#iso-count").disabled = !event.target.checked;
  state.controller?.setLayerVisible("multiple", event.target.checked);
});
$("#iso-count").addEventListener("input", event => {
  state.surfaceCount = Number(event.target.value);
  $("#iso-count-value").textContent = String(state.surfaceCount);
  state.controller?.setSurfaceCount(state.surfaceCount);
});
$("#iso-radius").addEventListener("input", event => {
  state.tubeRadius = Number(event.target.value);
  $("#iso-radius-value").textContent = state.tubeRadius.toFixed(3);
  state.controller?.setTubeRadius(state.tubeRadius);
});
$("#show-electric").addEventListener("change", event => { state.controller?.setLayerVisible("electric", event.target.checked); updateLegend(); });
$("#show-magnetic").addEventListener("change", event => { state.controller?.setLayerVisible("magnetic", event.target.checked); updateLegend(); });
$("#play-toggle").addEventListener("click", event => {
  state.playing = !state.playing;
  state.playing ? state.controller?.play() : state.controller?.pause();
  event.currentTarget.textContent = state.playing ? "PAUSE TIME" : "PLAY TIME";
  event.currentTarget.setAttribute("aria-pressed", String(state.playing));
});
$("#reset-time").addEventListener("click", () => {
  state.time = 0;
  $("#time-slider").value = "0";
  state.controller?.setTime(0);
  updateLegend();
});

start();

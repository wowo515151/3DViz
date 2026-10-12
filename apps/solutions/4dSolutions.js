import { mount, makeVectorPlotter, makeIsosurfacePlotter } from "../../library/three-viz/src/index.js?v=20261012a";

const $ = selector => document.querySelector(selector);
const RANGE = 2.5;
const DEFAULT_RESOLUTION = 11;
const COLORS = Object.freeze({ electric: 0xed5363, magnetic: 0x529cff });
const ISO_OPTIONS = Object.freeze({ threshold: 0.34, nested: false, surfaceCount: 5, tubeRadius: 0.006, wireframe: true, surfaceVisible: true });

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
    kind: "SOURCE-FREE PLANE WAVE", heading: "Circularly polarized plane wave",
    description: "A plane-fronted vacuum family. This view shows one circularly polarized monochromatic member travelling along +z.",
    equation: "F = E + iB = (x̂ + i ŷ) e^{i(z − t)}\nE = Re(F),  B = Im(F);  c = 1",
    caveat: "The arbitrary-profile family replaces e^{i(z−t)} with a suitable function of z−t.",
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
    id: "rn", symbol: "Q/r²", name: "Reissner–Nordström", short: "charged spherical electrovacuum · curved spacetime",
    kind: "EINSTEIN–MAXWELL ELECTROVACUUM", heading: "Reissner–Nordström exterior",
    description: "A static, spherically symmetric charged black-hole exterior solving the coupled Einstein–Maxwell equations. The electric field is radial in the local static orthonormal frame.",
    equation: "ds² = −f dt² + f⁻¹ dr² + r²dΩ²\nf = 1−2M/r+Q²/r²\nF = (Q/r²) dt∧dr",
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
    id: "weber", symbol: "Dν(x)", name: "Nonparaxial elegant Laguerre–Gaussian TE/TM beams", short: "closed-form exact Maxwell beam families",
    category: "Minkowski · exact vector beams",
    description: "Closed-form nonparaxial TE and TM beam solutions can be built from elegant Laguerre–Gaussian scalar Helmholtz modes. They retain longitudinal fields and arbitrary radial or azimuthal polarization order.",
    equation: "(∇²+k²)ψₚₘ = 0\nΠₑ,ₘ = polarization-vector × ψₚₘ\nE,B = exact Hertz curl operators; ψₚₘ uses spherical Bessel / Legendre modes",
    caveat: "These are full-vector solutions, distinct from the paraxial Gaussian-beam approximation commonly used in optics.",
    source: "https://doi.org/10.1364/OL.33.001563",
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
    caveat: "Airy beams are recovered only in a paraxial limit. The ideal non-paraxial solutions have extended spectra and are represented here symbolically.",
    source: "https://doi.org/10.1103/PhysRevLett.108.163901",
  }),
  symbolicFamily({
    id: "rindler-wave", symbol: "KᵢΩ/a", name: "Relativistic accelerating Maxwell waves", short: "exact TE/TM modes in Rindler spacetime",
    category: "Minkowski · exact Maxwell modes in accelerated coordinates",
    description: "A Maxwell field with fixed shape in a uniformly accelerated Rindler frame appears as an accelerating electromagnetic wave to inertial observers. Its non-relativistic limit connects to Airy-like beams.",
    equation: "ds² = −a²Z²dT²+dx²+dy²+dZ²\nU = e^{−iΩT+i k⊥·x⊥}KᵢΩ/a(k⊥Z)\nAᴱ, Aᴹ are the TE/TM potentials built from U;  F=dA",
    caveat: "Rindler coordinates cover a wedge of Minkowski spacetime and describe uniformly accelerated observers; this exact solution is a coordinate-frame family, not a self-gravitating field.",
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

const SAMPLED_FIELDS = new Set(["plane", "bessel", "dipole", "hopfion", "coulomb", "uniform"]);
const CURVED_REFERENCES = new Set(["rn", "kn", "wald", "melvin", "br", "charged-nariai", "plebanski-hacyan", "mp", "iwp", "emwave", "bell-szekeres", "robinson-trautman", "weyl-electrovac", "pd", "cmetric", "ernst-accelerating", "magnetized-black-hole", "harrison", "kn-ads"]);

const state = { controller: undefined, solution: "plane", time: 0, resolution: DEFAULT_RESOLUTION, surfaceResolution: 11, playing: false, electric: true, magnetic: true, isosurfaces: true, threshold: ISO_OPTIONS.threshold, nested: false, surfaceCount: ISO_OPTIONS.surfaceCount, tubeRadius: ISO_OPTIONS.tubeRadius, solidSurface: true, wireframes: true };

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

function solutionField(id, x, y, z, t) {
  if (id === "plane") {
    const phase = z - t;
    return { ex: Math.cos(phase), ey: -Math.sin(phase), ez: 0, bx: Math.sin(phase), by: Math.cos(phase), bz: 0 };
  }
  if (id === "bessel") {
    const kappa = 1.1, kz = 1.1, omega = Math.hypot(kappa, kz);
    const rho = Math.hypot(x, y), phase = kz * z - omega * t;
    const er = kz * kappa * besselJ1(kappa * rho) * Math.sin(phase);
    const ez = kappa * kappa * besselJ0(kappa * rho) * Math.cos(phase);
    const bphi = omega * kappa * besselJ1(kappa * rho) * Math.sin(phase);
    const invRho = rho > 1e-9 ? 1 / rho : 0;
    return { ex: er * x * invRho, ey: er * y * invRho, ez, bx: -bphi * y * invRho, by: bphi * x * invRho, bz: 0 };
  }
  if (id === "dipole") {
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

  if (id === "coulomb") {
    const r = Math.hypot(x, y, z);
    if (r < 0.42) return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0 };
    const scale = 1 / (r * r * r);
    return { ex: x * scale, ey: y * scale, ez: z * scale, bx: 0, by: 0, bz: 0 };
  }

  if (id === "uniform") return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 1 };

  // Catalogued families without a validated sample model are reference-only.
  if (id !== "hopfion") {
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
  return rows.map((row, index) => ({ id: row.id, label: row.label, x: row.x, y: row.y, z: row.z, value: magnitudes[index] / peak }));
}

function hasCurvedReference(id) {
  return CURVED_REFERENCES.has(id);
}

function hasSampledField(id) {
  return SAMPLED_FIELDS.has(id);
}

function isReferenceOnly(id) {
  return !hasSampledField(id);
}

function hasSpatialMagnitudeVariation(id) {
  return hasSampledField(id) && !["plane", "uniform"].includes(id);
}

function componentRows(rows, component) {
  const prefix = component === "electric" ? "e" : "b";
  return rows.map(row => ({ ...row, u: row[`${prefix}x`], v: row[`${prefix}y`], w: row[`${prefix}z`] }));
}

function updateLegend() {
  const solution = SOLUTIONS.find(item => item.id === state.solution);
  const curvedReference = hasCurvedReference(solution.id);
  const referenceOnly = isReferenceOnly(solution.id);
  const time = state.time.toFixed(2);
  $("#time-value").textContent = time;
  $("#time-slider").value = String(state.time);
  $("#time-readout").textContent = `t = ${time}`;
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
  $("#legend-meta").textContent = curvedReference ? "CURVED REFERENCE · METRIC RENDERING UNAVAILABLE" : referenceOnly ? "SYMBOLIC FAMILY · FIELD SAMPLER UNAVAILABLE" : "x, y, z at fixed t · normalized field display";
  $("#iso-note").textContent = curvedReference
    ? "This curved-spacetime field is catalogued exactly above; curved geometry rendering is not available in this view."
    : referenceOnly
      ? "This exact family is documented symbolically; a validated field sampler is not implemented in this viewer."
    : !hasSpatialMagnitudeVariation(solution.id)
      ? "This solution has spatially constant field magnitude, so it has no magnitude isosurface."
      : "Surfaces show normalized |E| and |B|. Set tube radius to 0 for flat wire lines.";
  const isoAvailable = hasSpatialMagnitudeVariation(solution.id);
  $("#show-isosurfaces").disabled = !isoAvailable;
  $("#iso-threshold").disabled = !isoAvailable;
  $("#iso-solid").disabled = !isoAvailable;
  $("#iso-wireframe").disabled = !isoAvailable;
  $("#iso-multiple").disabled = !isoAvailable || $("#iso-solid").checked;
  $("#iso-count").disabled = !isoAvailable || $("#iso-solid").checked || !$("#iso-multiple").checked;
  $("#iso-resolution").disabled = !isoAvailable;
  $("#iso-radius").disabled = !isoAvailable;
  $("#time-slider").disabled = referenceOnly;
  $("#play-toggle").disabled = referenceOnly || !state.controller;
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
      const vectorOptions = { maximumHeight: 0.24, positionBounds: [[-2.5, 2.5], [-2.5, 2.5], [-2.5, 2.5]] };
      const electricGroup = new THREE.Group();
      const magneticGroup = new THREE.Group();
      const electricVectorGroup = new THREE.Group();
      const magneticVectorGroup = new THREE.Group();
      const electricIsoGroup = new THREE.Group();
      const magneticIsoGroup = new THREE.Group();
      electricGroup.name = "electric-field-layer";
      magneticGroup.name = "magnetic-field-layer";
      electricIsoGroup.name = "electric-isosurfaces";
      magneticIsoGroup.name = "magnetic-isosurfaces";
      electricGroup.add(electricVectorGroup, electricIsoGroup);
      magneticGroup.add(magneticVectorGroup, magneticIsoGroup);
      scene.add(electricGroup, magneticGroup);
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
      let rows = initial.rows;
      let activeTime = initial.time;
      let elapsed = 0;
      let surfaceElapsed = 0;
      const refresh = (refreshSurfaces = true) => {
        rows = fieldRows(state.solution, activeTime, state.resolution);
        ePlot.update(componentRows(rows, "electric"));
        bPlot.update(componentRows(rows, "magnetic"));
        electricIsoGroup.visible = state.isosurfaces && hasSpatialMagnitudeVariation(state.solution);
        magneticIsoGroup.visible = electricIsoGroup.visible;
        if (refreshSurfaces && hasSampledField(state.solution)) {
          const surfaceRows = fieldRows(state.solution, activeTime, state.surfaceResolution);
          try { eIsoPlot.update(magnitudeRows(surfaceRows, "electric")); } catch { /* some exact fields have no shell at the selected level */ }
          try { bIsoPlot.update(magnitudeRows(surfaceRows, "magnetic")); } catch { /* some exact fields have no shell at the selected level */ }
        }
        context.requestRender();
      };
      electricGroup.visible = state.electric;
      magneticGroup.visible = state.magnetic;
      electricIsoGroup.visible = state.isosurfaces && hasSpatialMagnitudeVariation(state.solution);
      magneticIsoGroup.visible = electricIsoGroup.visible;
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
          if (id === "isosurfaces") { state.isosurfaces = Boolean(visible); electricIsoGroup.visible = state.isosurfaces && hasSpatialMagnitudeVariation(state.solution); magneticIsoGroup.visible = electricIsoGroup.visible; }
          context.requestRender();
        },
        setThreshold(value) {
          for (const plot of [eIsoPlot, bIsoPlot]) {
            try { plot.setThreshold(value); } catch { /* constant-magnitude components have no shell threshold */ }
          }
          state.threshold = Number(value);
        },
        setLayer(id, visible) {
          for (const plot of [eIsoPlot, bIsoPlot]) {
            try { plot.setLayerVisible(id, visible); } catch { /* a constant component has no isosurface */ }
          }
        },
        setTubeRadius(value) { eIsoPlot.setTubeRadius(value); bIsoPlot.setTubeRadius(value); state.tubeRadius = Number(value); },
        setSurfaceCount(value) {
          for (const plot of [eIsoPlot, bIsoPlot]) {
            try { plot.setSurfaceCount(value); } catch { /* a constant component has no isosurface */ }
          }
          state.surfaceCount = Number(value);
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
          scene.remove(electricGroup, magneticGroup);
        },
      };
    },
  });
}

function renderSolutionList() {
  const list = $("#solution-list");
  const query = $("#solution-search").value.trim().toLocaleLowerCase();
  const matches = SOLUTIONS.filter(solution => !query || [solution.name, solution.short, solution.kind, solution.description, solution.equation].join(" ").toLocaleLowerCase().includes(query));
  $("#solution-count").textContent = query ? `${matches.length}/${SOLUTIONS.length} entries` : `${SOLUTIONS.length} entries`;
  const buttons = matches.map(solution => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "solution-button";
    button.dataset.solution = solution.id;
    button.setAttribute("aria-pressed", String(solution.id === state.solution));
    button.innerHTML = `<span class="solution-symbol" aria-hidden="true">${solution.symbol}</span><span><strong>${solution.name}</strong><small>${solution.short}</small></span><span aria-hidden="true">↗</span>`;
    button.addEventListener("click", () => {
      if (isReferenceOnly(solution.id) && state.playing) {
        state.controller?.pause();
        state.playing = false;
        $("#play-toggle").textContent = "PLAY TIME";
        $("#play-toggle").setAttribute("aria-pressed", "false");
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
    $("#status-text").textContent = "SPACETIME SLICE READY";
    $("#status-dot").className = "status-dot ready";
    $("#play-toggle").disabled = false;
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
$("#iso-threshold").addEventListener("input", event => {
  state.threshold = Number(event.target.value);
  $("#iso-threshold-value").textContent = state.threshold.toFixed(2);
  try { state.controller?.setThreshold(state.threshold); showError(""); }
  catch (error) { showError(error.message); }
});
$("#iso-solid").addEventListener("change", event => {
  if (event.target.checked) $("#iso-multiple").checked = false;
  $("#iso-multiple").disabled = event.target.checked;
  $("#iso-count").disabled = event.target.checked || !$("#iso-multiple").checked;
  state.controller?.setLayer("surface", event.target.checked);
  state.controller?.setLayer("multiple", $("#iso-multiple").checked);
});
$("#iso-wireframe").addEventListener("change", event => state.controller?.setLayer("wireframe", event.target.checked));
$("#iso-multiple").addEventListener("change", event => {
  if (event.target.checked) {
    $("#iso-solid").checked = false;
    state.controller?.setLayer("surface", false);
  }
  $("#iso-count").disabled = !event.target.checked;
  state.controller?.setLayer("multiple", event.target.checked);
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

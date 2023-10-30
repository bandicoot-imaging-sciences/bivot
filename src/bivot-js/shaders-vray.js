const glsl = x => x.toString(); // No-op to trigger GLSL syntax highlighting in VS Code with glsl-literal extension.
const VRayMtlFragShader = glsl`
// Adapted from V-Ray Material Shader, by Chaos Software Ltd.
//********************************************************************
// V-Ray Material Shader
//
// Copyright (c) 2020 Chaos Software Ltd
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//********************************************************************

precision highp float;

#define PI 3.1415926535897932384626433832795
#define INV_PI 0.31830988618
#define INV_2PI 0.15915494309
#define LARGE_FLOAT (1e18f)

// A spherical env map affects how the LOD is computed based on normal
#define ENV_MAP_SPHERICAL 0
// How many env samples to take - increase for rougher surfaces
#define NUM_ENV_SAMPLES 8
// Additional samples added for rough reflection & refraction
#define NUM_ENV_SAMPLES_ROUGH 16
// Set to 1 to use a procedural checker environment (useful for local testing)
#define PROCEDURAL_ENV 1

// color conversion
vec3 srgb_from_rgb(vec3 rgb) {
	vec3 a = vec3(0.055, 0.055, 0.055);
	vec3 ap1 = vec3(1.0, 1.0, 1.0) + a;
	vec3 g = vec3(2.4, 2.4, 2.4);
	vec3 ginv = 1.0 / g;
	vec3 select = step(vec3(0.0031308, 0.0031308, 0.0031308), rgb);
	vec3 lo = rgb * 12.92;
	vec3 hi = ap1 * pow(rgb, ginv) - a;
	return mix(lo, hi, select);
}

vec3 rgb_from_srgb(vec3 srgb) {
	vec3 a = vec3(0.055, 0.055, 0.055);
	vec3 ap1 = vec3(1.0, 1.0, 1.0) + a;
	vec3 g = vec3(2.4, 2.4, 2.4);
	vec3 select = step(vec3(0.04045, 0.04045, 0.04045), srgb);
	vec3 lo = srgb / 12.92;
	vec3 hi = pow((srgb + a) / ap1, g);
	return mix(lo, hi, select);
}



// Engine-specific functions {{{
// These must be implemented depending on your engine
// The implementation here is for use in ShaderToy, with env map in iChannel0
// Note that the TextureEnvMapLOD and EnvIrradiance functions must return linear rgb

// Get maximum lod for texture env
float engGetMaxEnvLOD() {
  return 1.0;
#if 0
  ivec2 envSize = textureSize(iChannel0, 0);
	float minsz = float(max(envSize.x, envSize.y));
	return log2(minsz);
#endif
}

// Convert Cartesian vector to spherical coordinates
vec2 toSpherical(vec3 dir) {
	float alpha, beta;
	if (dir.z * dir.z + dir.x * dir.x < 1e-12) {
		alpha = 0.0;
		beta = (dir.y > 0.0) ? 0.0 : 1.0;
	} else {
		alpha = atan(dir.z, dir.x) * INV_PI;
		beta = acos(clamp(dir.y, -1.0, 1.0)) * INV_PI;
	}

	float u = alpha * 0.5 + 0.5;
	float v = beta;
	return vec2(u, v);
}

vec3 sampleCheckerEnv(vec3 dir) {
	vec2 uv = toSpherical(dir);
	float size = 0.1;
	int x = int(floor(uv.x / size));
	int y = int(floor(uv.y / size));
	return vec3(1.0 - float((x + y) & 1));
}

// Sample environment with LOD
vec3 engTextureEnvMapLOD(vec3 dir, float lod) {
    return vec3(0.0, 0.0, 0.0);
#if 0
#if PROCEDURAL_ENV == 1
	return sampleCheckerEnv(dir);
#else
    vec3 color;
#   if ENV_MAP_SPHERICAL
    vec2 texcoord = toSpherical(dir);
    texcoord.y = 1.0 - texcoord.y;
    color = textureLod(iChannel0, texcoord, lod).xyz;
#   else
    color = textureLod(iChannel0, dir, lod).xyz;
#   endif
    return rgb_from_srgb(color);
#endif
# endif
}

// Diffuse environment light (averaged over the hemisphere)
vec3 engEnvIrradiance(vec3 dir) {
    return vec3(0.0, 0.0, 0.0);
#if 0
#if PROCEDURAL_ENV == 1
	return sampleCheckerEnv(dir);
#else
	float lod = max(0.0, engGetMaxEnvLOD() - 1.0);
	return rgb_from_srgb(textureLod(iChannel0, dir, lod).xyz);
#endif
#endif
}

/// Get the LOD for sampling the environment
/// @param Wn World-space normal
/// @param p Probability of this direction (from sampleBRDF)
/// @param numSamples Number of environment samples for the BRDF
float computeEnvLOD(vec3 Wn, float p, int numSamples) {
    return 0.0;
#if 0
#if ENV_MAP_SPHERICAL
	float distortion = sqrt(max(0.0, 1.0 - Wn.y * Wn.y));
#else
	float distortion = 1.0;
#endif
	if (numSamples < 2) {
		return 0.0;
	} else {
		return max(0.0, (engGetMaxEnvLOD() - 0.5 * log2(1.0 + float(numSamples) * p * INV_2PI * distortion)));
	}
#endif
}

// }}} engine-specific functions

struct VRayMtlInitParams {
	vec3 Vw;
	vec3 geomNormal;
	vec3 diffuseColor;
	float diffuseAmount;
	float roughness;
	vec3 selfIllum;
	vec3 reflColor;
	float reflAmount;
	float reflGloss;
	bool traceReflections;
	float metalness;
	float aniso;
	float anisoRotation;
	int anisoAxis;
	vec3 opacity;
	vec3 refractionColor;
	float refractionAmount;
	float refrGloss;
	bool traceRefractions;
	float refractionIOR;
	bool useFresnel;
	float fresnelIOR;
	bool lockFresnelIOR;
	bool doubleSided;
	bool useRoughness;
	float gtrGamma;
	float thinFilmThickness;
	float thinFilmIOR;
};

struct VRayMtlContext {
	vec3 geomNormal;
	float gloss1;
	float roughnessSqr;
	float reflGloss;
	vec3 e;
	vec3 diff;
	float fresnel;
	vec3 refl;
	vec3 refr;
	vec3 illum;
	vec3 opacity;
	float rtermA;
	float rtermB;
	float gtrGamma;
	float fragmentNoise; // per-fragment noise value
	mat3 nm;
	mat3 inm;
	float anisotropy;
};

vec3 sampleBRDF(VRayMtlInitParams params, VRayMtlContext ctx,
		int sampleIdx, int nbSamples, out float brdfContrib);
vec3 sampleRefractBRDF(VRayMtlInitParams params, VRayMtlContext ctx,
		int sampleIdx, int nbSamples, out bool totalInternalReflection);

VRayMtlContext initVRayMtlContext(VRayMtlInitParams initParams);

vec3 computeDirectDiffuseContribution(VRayMtlInitParams params, VRayMtlContext ctx, vec3 lightDir);
vec3 computeDirectReflectionContribution(VRayMtlInitParams params, VRayMtlContext ctx, vec3 lightDir);

vec3 computeIndirectDiffuseContribution(VRayMtlInitParams params, VRayMtlContext ctx);
vec3 computeIndirectReflectionContribution(VRayMtlInitParams params, VRayMtlContext ctx);
vec3 computeIndirectRefractionContribution(VRayMtlInitParams params, VRayMtlContext ctx, float alpha, vec3 alphaDir);

// utility functions {{{

float sqr(float x) {
	return x * x;
}

// return random number in [0, 1)
float hashRand(vec2 co) {
	return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// return random vector in [0, 1)
vec2 rand(VRayMtlContext ctx, int sampleIdx, int nbSamples) {
	// fibonacci spiral distribution using the plastic constant
	const float plast = 1.324717957244746;
	const float invPlast = 1.0/plast;
	return vec2(
		fract(float(sampleIdx + 1) * invPlast),
		float(sampleIdx) / float(nbSamples) + ctx.fragmentNoise
	);
}

float intensity(vec3 v) {
	return (v.x + v.y + v.z) / 3.0;
}

vec3 whiteComplement(vec3 x) {
	return clamp(1.0 - x, 0.0, 1.0);
}

// }}} end utility functions

/// Compute the two orthogonal vectors to a given input vector
/// @param n Input vector
/// @param[out] u The first orthogonal vector
/// @param[out] v The second orthogonal vector
void computeTangentVectors(vec3 n, out vec3 u, out vec3 v) {
	// It doesn't matter what these vectors are, the result vectors just need to be perpendicular to the normal and to
	// each other
	u = cross(n, vec3(0.643782, 0.98432, 0.324632));
	if (length(u) < 1e-6)
		u = cross(n, vec3(0.432902, 0.43223, 0.908953));
	u = normalize(u);
	v = normalize(cross(n, u));
}

/// Make an orthogonal matrix given a surface normal
/// @param n The normal vector
/// @param[out] m The output orthogonal matrix with n in the third column
void makeNormalMatrix(in vec3 n, out mat3 m) {
	computeTangentVectors(n, m[0], m[1]);
	m[2] = n;
}

/// Compute dielectric Frensel coefficient.
/// @param cosIn The cosine between the normal and the viewing direction.
/// @param ior The index of refraction.
/// @return The Fresnel coefficient.
float getFresnelCoeff(float cosIn, float ior) {
	if (abs(ior - 1.0) < 1e-6)
		return 0.0;

	cosIn = min(cosIn, 1.0f);

	float eta = 1.0f / ior;
	float sinR = eta * sqrt(1.0f - cosIn * cosIn);
	if (sinR >= 1.0f)
		return 1.0f;

	float cosR = sqrt(1.0f - sinR * sinR);
	float pl = (cosIn - (eta * cosR)) / (cosIn + (eta * cosR));
	float pp = ((eta * cosIn) - cosR) / ((eta * cosIn) + cosR);

	float fresnel = (pl * pl + pp * pp) * 0.5f;
	return clamp(fresnel, 0.0f, 1.0f);
}

/// Compute a refraction direction for a given view direction
/// @param fresnelIOR IOR used for Fresnel calculations
/// @param refrIOR IOR used for refraction
/// @param e View direction
/// @param n Surface normal
/// @param[out] internalReflection True if this is a total internal reflection
/// @return The refraction direction
vec3 computeRefractDir(float fresnelIOR, float refrIOR, vec3 e, vec3 n, out bool internalReflection) {
	vec3 reflectDir = reflect(e, n);

	// check for internal reflection
	vec3  refractDir;
	bool  outToIn = (dot(n, e) < 0.0);
	float ior     = (outToIn ? 1.0 / refrIOR : refrIOR);
	vec3  normal  = (outToIn ? n : -n);
	fresnelIOR    = (outToIn ? fresnelIOR : ior);

	float cost    = -dot(e, normal);
	float sintSqr = 1.0 - ior * ior * (1.0 - cost * cost);
	if (sintSqr > 1e-6) {
		internalReflection = false;
		refractDir         = ior * e + (ior * cost - sqrt(sintSqr)) * normal;
	} else {
		internalReflection = true;
		refractDir         = reflectDir;
	}
	return refractDir;
}

/// Get the Fresnel reflectance for a conductor.
/// Accurate values for n and k can be obtained from https://refractiveindex.info/
/// For some conductors the n and k parameters vary with the light wavelength so the
/// Fresnel reflectance should be computed separately for R,G and B.
/// @param cosTheta Cosine of the angle between the view direction and the normal
/// @param n Refractive index
/// @param k Extinction coefficient
/// @return Fresnel reflectance.
float getConductorFresnel(float cosTheta, float n, float k) {
	float c2 = cosTheta * cosTheta;
	float n2k2 = n * n + k * k;
	float nc2 = 2.0f * n * cosTheta;
	float rsa = n2k2 + c2;
	float rpa = n2k2 * c2 + 1.0f;
	float rs = (rsa - nc2) / (rsa + nc2);
	float rp = (rpa - nc2) / (rpa + nc2);
	return 0.5f * (rs + rp);
}

/// Get the Fresnel reflectance for a conductor.
/// Accurate values for n and k can be obtained from https://refractiveindex.info/
/// Some presets can be found below.
/// For some conductors the n and k parameters vary with the light wavelength so the
/// Fresnel reflectance should be computed separately for R,G and B.
/// @param n Refractive index
/// @param k2 Extinction coefficient squared
/// @param cosIn Cosine of the angle between the view direction and the normal
/// @return Fresnel reflectance.
/// @note This formula is accurate for the metals but not for dielectrics when k is close to 0. 
/// For a general formula that is accurate both for conductors and dielectrics see 
/// https://seblagarde.wordpress.com/2013/04/29/memo-on-fresnel-equations/
vec3 getConductorFresnelK2(float cosIn, vec3 n, vec3 k2) {
	vec3 cosIn2 = vec3(cosIn * cosIn);
	vec3 twoKCos = 2.0f * n * cosIn;
	vec3 one = vec3(1.0f);

	vec3 t0 = n * n + k2;
	vec3 t1 = t0 * cosIn2;
	vec3 rs = (t0 - twoKCos + cosIn2) / (t0 + twoKCos + cosIn2);
	vec3 rp = (t1 - twoKCos + one) / (t1 + twoKCos + one);

	return 0.5f * (rp + rs);
}

/// Thin film reflectance functions based on the paper:
/// A Practical Extension to Microfacet Theory for the Modeling of Varying Iridescence
/// https://belcour.github.io/blog/research/publication/2017/05/01/brdf-thin-film.html
/// The main function is getFresnelAiry() and it's used as a replacement of the Fresnel term in BRDF calculations.
/// The thin film layer is parametrized with thickness (nanometers) and thin film IOR.
/// The thin film interference effect vanishes for thickness values close to 0 nm and larger than several thousand nm (e.g. 6000).

/// Fresnel for dielectric/dielectric interface and polarized light.
void getPolarizedDielectricFresnel(
	float cosTheta, ///< [in] Cosine of the angle between the view dir and the half vector
	float n1, ///< [in] IOR of the first dielectric layer
	float n2, ///< [in] IOR of the seond dielectric layer
	out vec2 F, ///< [out] The amplitude of the complex polarized Fresnel reflectance (s-polarized in the X component, p-polarized in the Y component).
	out vec2 phi ///< [out] The phase shift of the complex polarized Fresnel reflectance (s-polarized in the X component, p-polarized in the Y component).
) {
	// n2 zero check is done outside of this function.
	float eta2 = sqr(n1 / n2);
	float st2 = 1.0f - cosTheta * cosTheta;

	// Check for total internal reflection
	if (eta2 * st2 >= 1.0f) {
		F = vec2(1.0f, 1.0f);
		// eta2 can't be 0, we check n1 and n2 in getFresnelAiry()
		float s = (abs(cosTheta) > 1e-6f) ? (sqrt(st2 - 1.0f / eta2) / cosTheta) : LARGE_FLOAT;
		phi.x = 2.0f * atan(-eta2 * s);
		phi.y = 2.0f * atan(-s);
		return;
	}

	float cosTheta_t = sqrt(1.0f - eta2 * st2);
	// rDenom can't be 0 because both n1 and n2 are non-zero (checked in getFresnelAiry())
	// and at least one of cosTheta and cosTheta_t has to be non-zero.
	vec2 rDenom = vec2(
		n2 * cosTheta + n1 * cosTheta_t,
		n1 * cosTheta + n2 * cosTheta_t
	);
	vec2 r = vec2(
		(n2 * cosTheta - n1 * cosTheta_t) / rDenom.x,
		(n1 * cosTheta - n2 * cosTheta_t) / rDenom.y
	);
	F = vec2(sqr(r.x), sqr(r.y));
	phi.x = (r.x < 0.0f) ? PI : 0.0f;
	phi.y = (r.y < 0.0f) ? PI : 0.0f;
}

/// Fresnel for dielectric/conductor interface and polarized light.
void getPolarizedConductorFresnel(
	float cosTheta, ///< [in] Cosine of the angle between the view dir and the half vector
	float n1, ///< [in] IOR of the dielectric layer.
	float n2, ///< [in] IOR of the conductor layer.
	float kSqr, ///< [in] Extinction coefficient of the conductor layer. TODO: Add support for wavelength dependent extinction (vec3).
	out vec2 F, ///< [out] The amplitude of the complex polarized Fresnel reflectance (s-polarized in the X component, p-polarized in the Y component).
	out vec2 phi ///< [out] The phase shift of the complex polarized Fresnel reflectance (s-polarized in the X component, p-polarized in the Y component).
) {
	if (kSqr < 1e-12f) {
		// Use dielectric formula to avoid numerical issues
		getPolarizedDielectricFresnel(cosTheta, n1, n2, F, phi);
		return;
	}

	float k = sqrt(kSqr);
	float n1Sqr = sqr(n1);
	float n2Sqr = sqr(n2);

	float A = n2Sqr * (1.0f - kSqr) - n1Sqr * (1.0f - sqr(cosTheta));
	float B = sqrt(sqr(A) + sqr(2.0f * n2Sqr * kSqr));
	float U = sqrt((A + B) * 0.5f);
	float V = sqrt((B - A) * 0.5f);

	float uSqr = sqr(U);
	float vSqr = sqr(V);
	float C = n1 * cosTheta;
	float fyDenom = sqr(C + U) + vSqr;
	F.y = (sqr(C - U) + vSqr) / fyDenom;
	phi.y = atan(
		2.0f * V * C,
		uSqr + vSqr - sqr(C)
	) + PI;

	float D = n2Sqr * cosTheta;
	float E = D * (1.0f - kSqr);
	float G = n1 * U;
	float H = 2.0f * n2Sqr * k * cosTheta;
	float I = n1 * V;

	float fxDenom = sqr(E + G) + sqr(H + I);
	F.x = (sqr(E - G) + sqr(H - I)) / fxDenom;
	phi.x = atan(
		2.0f * n1 * I * (2.0f * k * U - (1.0f - kSqr) * V),
		sqr(I * (1.0f + kSqr)) - n1Sqr * (uSqr + vSqr)
	);
}

/// Fresnel for dielectric/conductor interface and polarized light.
void getPolarizedConductorFresnel_f3(
	float cosTheta, ///< [in] Cosine of the angle between the view dir and the half vector
	float n1, ///< [in] IOR of the dielectric layer.
	vec3 n2, ///< [in] IOR of the conductor layer.
	vec3 kSqr, ///< [in] Extinction coefficient of the conductor layer.
	out vec3 Fs, ///< [out] The amplitude of the complex polarized Fresnel reflectance (s-polarized).
	out vec3 Fp, ///< [out] The amplitude of the complex polarized Fresnel reflectance (p-polarized).
	out vec3 phis, ///< [out] The phase shift of the complex polarized Fresnel reflectance (s-polarized).
	out vec3 phip ///< [out] The phase shift of the complex polarized Fresnel reflectance (p-polarized).
) {
	vec2 Fx, Fy, Fz, phix, phiy, phiz;
	getPolarizedConductorFresnel(cosTheta, n1, n2.x, kSqr.x, Fx, phix);
	getPolarizedConductorFresnel(cosTheta, n1, n2.y, kSqr.y, Fy, phiy);
	getPolarizedConductorFresnel(cosTheta, n1, n2.z, kSqr.z, Fz, phiz);
	Fs = vec3(Fx.x, Fy.x, Fz.x);
	Fp = vec3(Fx.y, Fy.y, Fz.y);
	phis = vec3(phix.x, phiy.x, phiz.x);
	phip = vec3(phix.y, phiy.y, phiz.y);
}

/// Evaluate XYZ sensitivity curves in Fourier space
vec3 evalXYZSensitivityFourier(
	float opd, ///< [in] Optical path difference
	vec3 shift ///< [in] Phase shift
) {
	// Use Gaussian fits, given by 3 parameters: val, pos and var
	float phase = 2.0f * PI * opd;
	const vec3 val = vec3(5.4856e-13f, 4.4201e-13f, 5.2481e-13f);
	const vec3 pos = vec3(1.6810e+06f, 1.7953e+06f, 2.2084e+06f);
	const vec3 var = vec3(4.3278e+09f, 9.3046e+09f, 6.6121e+09f);
	vec3 sqrtTerm = vec3(
		sqrt(2.0f * PI * var.x),
		sqrt(2.0f * PI * var.y),
		sqrt(2.0f * PI * var.z)
	);
	vec3 cosTerm = vec3(
		cos(pos.x * phase + shift.x),
		cos(pos.y * phase + shift.y),
		cos(pos.z * phase + shift.z)
	);
	vec3 expTerm = vec3(
		exp(-var.x * phase * phase),
		exp(-var.y * phase * phase),
		exp(-var.z * phase * phase)
	);
	vec3 xyz = val * sqrtTerm * cosTerm * expTerm;
	xyz.x += 9.7470e-14f * sqrt(2.0f * PI * 4.5282e+09f) * cos(2.2399e+06f * phase + shift.x) * exp(-4.5282e+09f * phase * phase);
	return xyz / 1.0685e-7f;
}

/// Equation 10 in the paper.
/// All inputs should be either s-polarized or p-polarized.
vec3 getFourierSpectralIntegral(
	vec3 S0,
	float R12,
	vec3 Rs,
	float T121,
	vec3 r123,
	float D,
	vec3 phi2
) {
	// Reflectance term for m=0 (DC term amplitude)
	vec3 C0 = vec3(R12, R12, R12) + Rs;
	vec3 R = C0 * S0;

	// Reflectance term for m>0 (pairs of diracs)
	vec3 Cm = Rs - vec3(T121, T121, T121);
	for (int m = 1; m <= 2; ++m) {
		Cm = Cm * r123;
		vec3 Sm = 2.0f * evalXYZSensitivityFourier(float(m) * D, float(m) * phi2);
		R += Cm * Sm;
	}

	return R;
}

/// Airy reflectance that replaces the Fresnel term when thin film is used.
/// Based on the paper:
/// A Practical Extension to Microfacet Theory for the Modeling of Varying Iridescence
/// https://belcour.github.io/blog/research/publication/2017/05/01/brdf-thin-film.html
/// @return Airy reflectance.
vec3 getFresnelAiry(
	float cosTheta, ///< [in] Cosine of the angle between the view dir and the half vector
	vec3 ior, ///< [in] IOR of the layer below the thin film
	vec3 extinctionSqr, ///< Squared extinction coefficient of the layer below the thin film
	float thinFilmThickness, ///< [in] Thin film thickness in nanometers
	float thinFilmIOR ///< [in] IOR of the thin film layer
) {
	if (cosTheta < 1e-6f) {
		return vec3(0.0f);
	}

	if (ior.x <= 1e-6f || thinFilmIOR <= 1e-6f) {
		return vec3(1.0f);
	}

	// Assume vacuum on the outside
	float eta1 = 1.0f;
	float eta2 = thinFilmIOR;

	// Check for total internal reflection
	float sinThetaRefrSqr = sqr(eta1 / eta2) * (1.0f - sqr(cosTheta));
	if (sinThetaRefrSqr >= 1.0f) {
		return vec3(1.0f);
	}

	// Convert nm -> m
	float d = thinFilmThickness * 1e-9f;

	// Optical path difference
	float cosTheta2 = sqrt(1.0f - sinThetaRefrSqr);
	float D = 2.0f * eta2 * d * cosTheta2;

	// First interface
	vec2 R12, phi12;
	getPolarizedDielectricFresnel(cosTheta, eta1, eta2, R12, phi12);
	vec2 T121 = vec2(1.0f, 1.0f) - R12;
	vec2 phi21 = vec2(PI, PI) - phi12;

	// Second interface
	vec3 R23s, R23p, phi23s, phi23p;
	getPolarizedConductorFresnel_f3(cosTheta2, eta2, ior, extinctionSqr, R23s, R23p, phi23s, phi23p);

	// Phase shift
	vec3 phi2s = vec3(phi21.x, phi21.x, phi21.x) + phi23s;
	vec3 phi2p = vec3(phi21.y, phi21.y, phi21.y) + phi23p;

	// Compound terms
	vec3 R = vec3(0.0f, 0.0f, 0.0f);
	vec3 R123s = R12.x * R23s;
	vec3 R123p = R12.y * R23p;
	vec3 r123s = sqrt(R123s);
	vec3 r123p = sqrt(R123p);
	vec3 rsDenoms = vec3(1.0f) - R123s;
	vec3 rsDenomp = vec3(1.0f) - R123p;

	// Use asserts to check the denominator because the only cases
	// when it's close to 0 so far have been due to incorrect negative cosTheta.
	vec3 Rss = sqr(T121.x) * R23s / rsDenoms;
	vec3 Rsp = sqr(T121.y) * R23p / rsDenomp;

	// Note: This is the AA solution described in 4. Analytic Spectral Integration
	vec3 S0 = vec3(1.0f); // evalXYZSensitivityFourier(0.0f, vec3(0.0f));

	// Reflectance term using spectral antialiasing for Perpendicular polarization
	R += getFourierSpectralIntegral(S0, R12.x, Rss, T121.x, r123s, D, phi2s);

	// Reflectance term using spectral antialiasing for Parallel polarization
	R += getFourierSpectralIntegral(S0, R12.y, Rsp, T121.y, r123p, D, phi2p);

	// R contains the sum of the 2 polarized reflectances.
	// In order to get the depolarized reflectance we just need to divide by 2 (this saves a few divisions).
	// This is done after the conversion to the renderer color space in the paper's supplemental code which is incorrect.
	R = R * 0.5f;

	// Convert back to RGB reflectance.
	// Note: This conversion has to be modified if the renderer's color space is different (e.g. sRGB or ACEScg).
	const mat3 xyzToRgb = mat3(
		2.370673f, -0.513883f, 0.005298f,
		-0.900039f, 1.425302f, -0.014695f,
		-0.470634f, 0.088581f, 1.009397f
	);
	R = clamp(xyzToRgb * R, vec3(0.0f), vec3(1.0f));

	return R;
}

/// Compute dielectric Frensel coefficient.
/// @param viewDir The viewing direction (towards the surface).
/// @param normal The normal pointing towards the outside of the surface.
/// @param ior The index of refraction.
/// @return The Fresnel coefficient for reflections.
vec3 getFresnelCoeffWithThinFilm(
	float cosIn,
	float ior,
	float thinFilmThickness,
	float thinFilmIOR
) {
	if (thinFilmThickness == 0.0f) {
		float fresnel = getFresnelCoeff(cosIn, ior);
		return vec3(fresnel);
	} else {
		return getFresnelAiry(
			cosIn,
			vec3(ior),
			vec3(0.0f) /* extinctionSqr */,
			thinFilmThickness,
			thinFilmIOR
		);
	}
}

/// Get the Fresnel reflectance for a conductor.
/// Accurate values for n and k can be obtained from https://refractiveindex.info/
/// Some presets can be found below.
/// For some conductors the n and k parameters vary with the light wavelength so the
/// Fresnel reflectance should be computed separately for R,G and B.
/// @param n Refractive index
/// @param k2 Extinction coefficient squared
/// @param cosIn Cosine of the angle between the view direction and the normal
/// @return Fresnel reflectance.
/// @note This formula is accurate for the metals but not for dielectrics when k is close to 0. 
/// For a general formula that is accurate both for conductors and dielectrics see 
/// https://seblagarde.wordpress.com/2013/04/29/memo-on-fresnel-equations/
vec3 getFresnelConductorWithThinFilm(
	vec3 n,
	vec3 k2,
	float cosIn,
	float thinFilmThickness,
	float thinFilmIOR
) {
	if (thinFilmThickness == 0.0f) {
		vec3 fresnel = getConductorFresnelK2(cosIn, n, k2);
		return vec3(fresnel);
	} else {
		return getFresnelAiry(cosIn, n, k2, thinFilmThickness, thinFilmIOR);
	}
}

vec3 getSpecularDir(float u, float v, float k) {
	float thetaSin = clamp(pow(u, 1.0 / (k + 1.0)), 0.0, 1.0);
	float thetaCos = sqrt(1.0 - thetaSin * thetaSin);
	float phi = 2.0 * PI * v;
	return vec3(cos(phi) * thetaCos, sin(phi) * thetaCos, thetaSin);
}

vec3 getSphereDir(float u, float v) {
	float thetaSin = u;
	float thetaCos = sqrt(1.0 - thetaSin * thetaSin);
	float phi = 2.0 * PI * v;
	return vec3(cos(phi) * thetaCos, sin(phi) * thetaCos, thetaSin);
}

vec3 getDiffuseDir(float u, float v) {
	float thetaSin = sqrt(u);
	float thetaCos = sqrt(1.0 - u);
	float phi = 2.0 * PI * v;
	return vec3(cos(phi) * thetaCos, sin(phi) * thetaCos, thetaSin);
}

vec3 getGTR1MicroNormal(float uc, float vc, float sharpness) {
	float sharpness2 = min(sharpness * sharpness, 0.999);
	float thetaCosSqr = (1.0 - pow(sharpness2, 1.0 - uc)) / (1.0 - sharpness2);
	float thetaCos = sqrt(thetaCosSqr);
	float thetaSin = sqrt(max(1.0 - thetaCosSqr, 0.0));

	float phi = 2.0 * PI * vc;
	return vec3(cos(phi) * thetaSin, sin(phi) * thetaSin, thetaCos);
}

// Specific implementation when gamma == 2. See section B.2 Physically-Based Shading at Disney from SIGGRAPH 2012
vec3 getGTR2MicroNormal(float uc, float vc, float sharpness) {
	float thetaCosSqr = (1.0 - uc) / (1.0 + (sharpness * sharpness - 1.0) * uc);
	float thetaCos = sqrt(thetaCosSqr);
	float thetaSin = sqrt(max(1.0 - thetaCosSqr, 0.0));

	float phi = 2.0 * PI * vc;
	return vec3(cos(phi) * thetaSin, sin(phi) * thetaSin, thetaCos);
}

// General implementation  when gamma != 1 and != 2. See section B.2 Physically-Based Shading at Disney from SIGGRAPH 2012
vec3 getGTRMicroNormal(float uc, float vc, float sharpness, float gtrGamma) {
	float sharpness2 = min(sharpness * sharpness, 0.999);
	float thetaCosSqr =
		(1.0 - pow(pow(sharpness2, 1.0 - gtrGamma) * (1.0 - uc) + uc, 1.0 / (1.0 - gtrGamma))) / (1.0 - sharpness2);
	float thetaCos = sqrt(thetaCosSqr);
	float thetaSin = sqrt(max(1.0 - thetaCosSqr, 0.0));

	float phi = 2.0 * PI * vc;
	return vec3(cos(phi) * thetaSin, sin(phi) * thetaSin, thetaCos);
}

vec3 getGGXMicroNormal(float uc, float vc, float sharpness, float gtrGamma) {
	if (abs(gtrGamma - 1.0) < 1e-3)
		return getGTR1MicroNormal(uc, vc, sharpness);
	else if (abs(gtrGamma - 2.0) < 1e-3)
		return getGTR2MicroNormal(uc, vc, sharpness);
	else // if (gtrLowerLimit <= gtrGamma && gtrGamma <= gtrUpperLimit)
		return getGTRMicroNormal(uc, vc, sharpness, gtrGamma);
}

float getGTR1MicrofacetDistribution(float mz, float sharpness) {
	float cosThetaM = mz; // dot(microNormal, normal);
	float cosThetaM2 = sqr(cosThetaM);
	float sharpness2 = sqr(sharpness);
	float div = PI * log(sharpness2) * (1.0 + (sharpness2 - 1.0) * cosThetaM2);
	// when div<(sharpness2-1.0)*1e-6 no division by zero will occur (the dividend and the divisor are always negative);
	// div can get 0 in rare situation when the sharpness read from texture mapped in reflection glossines is 0
	// and cosThetaM is 1 (and consequently 1+(sharpness2-1)*cosThetaM2 = 0).
	float res = (div < (sharpness2 - 1.0) * 1e-6) ? (sharpness2 - 1.0) / div : 0.0;

	return res;
}

float getGTR2MicrofacetDistribution(float mz, float sharpness) {
	float cosThetaM = mz; // dot(microNormal, normal);
	float cosThetaM2 = sqr(cosThetaM);
	float tanThetaM2 = (1.0 / cosThetaM2) - 1.0;
	float sharpness2 = sqr(sharpness);
	float div = PI * sqr(1.0 + (sharpness2 - 1.0) * cosThetaM2);
	// when div>sharpness2*1e-6 no division by zero will occur (the dividend and the divisor are always positive);
	// div canget0 in rare situation when the sharpness read from texture mapped in reflection glossines is 0
	// and cosThetaM is 1 (and consequently 1+(sharpness2-1)*cosThetaM2 = 0).
	float res = (div > sharpness2 * 1e-6) ? sharpness2 / div : 0.0;

	return res;
}

float getGTRMicrofacetDistribution(float mz, float sharpness, float gtrGamma) {
	float cosThetaM = mz; // dot(microNormal, normal);
	float cosThetaM2 = sqr(cosThetaM);
	float tanThetaM2 = (1.0 / cosThetaM2) - 1.0;
	float sharpness2 = sqr(sharpness);
	float divisor =
		PI * (1.0 - pow(sharpness2, 1.0 - gtrGamma)) * pow(1.0 + (sharpness2 - 1.0) * cosThetaM2, gtrGamma);
	float dividend = (gtrGamma - 1.0) * (sharpness2 - 1.0);
	// when abs(divisor)>abs(dividend)*1e-6 no division by zero will occur
	// (the dividend and the divisor are always either both positive or both negative);
	// divisor canget0 in rare situation when the sharpness read from texture mapped in reflection glossines is 0
	// and cosThetaM is 1 (and consequently 1+(sharpness2-1)*cosThetaM2 = 0).
	float res = (abs(divisor) > abs(dividend) * 1e-6) ? dividend / divisor : 0.0;

	return res;
}

float getGGXMicrofacetDistribution(float cosNH, float sharpness, float gtrGamma) {
	if (abs(gtrGamma - 1.0) < 1e-3)
		return getGTR1MicrofacetDistribution(cosNH, sharpness);
	else if (abs(gtrGamma - 2.0) < 1e-3)
		return getGTR2MicrofacetDistribution(cosNH, sharpness);
	else // if (gtrLowerLimit <= gtrGamma && gtrGamma <= gtrUpperLimit)
		return getGTRMicrofacetDistribution(cosNH, sharpness, gtrGamma);
}

float getGTRMonodirectionalShadowing0(float cotThetaV) {
	return 2.0 / (1.0 + sqrt(1.0 + 1.0 / (cotThetaV * cotThetaV)));
}

float getGTRMonodirectionalShadowing1(float sharpness, float cotThetaV) {
	float cotThetaV2 = sqr(cotThetaV);
	float sharpness2 = min(0.999, sqr(sharpness));
	float a = sqrt(cotThetaV2 + sharpness2);
	float b = sqrt(cotThetaV2 + 1.0);
	return cotThetaV * log(sharpness2) / (a - b + cotThetaV * log(sharpness2 * (cotThetaV + b) / (cotThetaV + a)));
}

float getGTRMonodirectionalShadowing2(float sharpness, float cotThetaV) {
	return 2.0 / (1.0 + sqrt(1.0 + sqr(sharpness / cotThetaV)));
}

float getGTRMonodirectionalShadowing3(float sharpness, float cotThetaV) {
	float cotThetaV2 = sqr(cotThetaV);
	float sharpness2 = min(0.999, sqr(sharpness));
	float a = sqrt(cotThetaV2 + sharpness2);
	float b = sharpness2 + 1.0;
	return 4.0 * cotThetaV * a * b / (2.0 * cotThetaV * b * (cotThetaV + a) + sharpness2 * (3.0 * sharpness2 + 1.0));
}

float getGTRMonodirectionalShadowing4(float sharpness, float cotThetaV) {
	float cotThetaV2 = cotThetaV * cotThetaV;
	float sharpness2 = min(0.999, sqr(sharpness));
	float sharpness4 = sharpness2 * sharpness2;
	float a = 8.0 * (sharpness4 + sharpness2 + 1.0);
	float b = sqrt(cotThetaV2 + sharpness2);
	float b3 = b * (cotThetaV2 + sharpness2);
	return 2.0 * cotThetaV * a * b3
		/ (a * cotThetaV * (b3 + cotThetaV * cotThetaV2)
		   + 3.0 * sharpness2
			   * (4.0 * cotThetaV2 * (2.0 * sharpness4 + sharpness2 + 1.0)
				  + sharpness2 * (5.0 * sharpness4 + 2.0 * sharpness2 + 1.0)));
}

float getGGXMonodirectionalShadowing(vec3 dir, vec3 hw, vec3 normal, float sharpness, float gtrGamma) {
	float cosThetaV = dot(dir, normal);

	if (cosThetaV <= 1e-3)
		return 0.0;

	if (dot(dir, hw) * cosThetaV <= 0.0) // Note: technically this is a division, but since we are only interested in
										 // the sign, we can do multiplication
		return 0.0;

	// when direction is collinear to the normal there is no shadowing
	// moreover if this case is not handled a division by zero will happen on the next line
	if (cosThetaV >= 1.0 - 1e-6)
		return 1.0;

	float cotThetaV = cosThetaV / sqrt(1.0 - sqr(cosThetaV));

	float res = 0.0;

	// when gamma is any of the integer values 0, 1, 2, 3, 4 apply analytical solution
	if (gtrGamma <= 0.01)
		res = getGTRMonodirectionalShadowing0(cotThetaV);
	else if (abs(gtrGamma - 1.0) <= 1e-2)
		res = getGTRMonodirectionalShadowing1(sharpness, cotThetaV);
	else if (abs(gtrGamma - 2.0) <= 1e-2)
		res = getGTRMonodirectionalShadowing2(sharpness, cotThetaV);
	else if (abs(gtrGamma - 3.0) <= 1e-2)
		res = getGTRMonodirectionalShadowing3(sharpness, cotThetaV);
	else if (gtrGamma >= 4.0 - 1e-2)
		res = getGTRMonodirectionalShadowing4(sharpness, cotThetaV);
	else {
		// gamma is not an integer. interpolate
		// gtrGamma is not an integer. interpolate
		// If we get here gtrGamma is in (0.01, 3.99).

		// We use a cubic spline curve with 5 knots to evaluate the shadowing, based on the results for integer values.
		// The original code used a CubicSpline<5> object to construct and evaluate the spline, but Vladimir Nedev
		// derived a simplified version for Lavina, which is used below.

		// knots[i].x is implicit and is equal to 'i', so we store only knots[i].y in knots[i].
		float knots[5];
		knots[0]=getGTRMonodirectionalShadowing0(cotThetaV);
		knots[1]=getGTRMonodirectionalShadowing1(sharpness, cotThetaV);
		knots[2]=getGTRMonodirectionalShadowing2(sharpness, cotThetaV);
		knots[3]=getGTRMonodirectionalShadowing3(sharpness, cotThetaV);
		knots[4]=getGTRMonodirectionalShadowing4(sharpness, cotThetaV);

		// The code that follows is a simplified version of the code for CubicSpline<5> that constructs the spline,
		// using the fact that the distance between the spline knots in x is always 1.
		// We also directly compute which polynomial we are going to use instead of binary searching.
		// From CubicSpline::construct: h[i] = 1
		// From evalMomentsNatural: m[i] = 4
		// We compute f, instead of 'c', since 'f' is the argument name of solveTridiagonal.
		// From solveTridiagonal:
		// a[i] = h[i] = 1
		// b[i] = h[i+1] = 1
		// c[i] = m[i+1] = 4;
		float f[3];
		f[0]=knots[2]-knots[1]-knots[1]+knots[0];
		f[1]=knots[3]-knots[2]-knots[2]+knots[1];
		f[2]=knots[4]-knots[3]-knots[3]+knots[2];

		f[1]-=0.25*f[0];
		f[2]-=0.26666666666666666666666666666667*f[1];

		// Reuse 'f'.
		f[2]=f[2]*0.26785714285714285714285714285715;
		f[1]=(f[1]-f[2])*0.26666666666666666666666666666667;
		f[0]=(f[0]-f[1])*0.25;

		int i=int(floor(gtrGamma));

		float mi=(i>0 ? f[i-1] : 0.0);
		float mi1=(i<3 ? f[i] : 0.0);
		float a=(mi1-mi);
		float b=(3.0*mi);
		float c=(knots[i+1]-knots[i])-(2.0*mi+mi1);
		float d=knots[i];

		float x=gtrGamma-float(i);
		res=((a*x+b)*x+c)*x+d;
	}

	return clamp(res, 0.0, 1.0);
}

float getGGXBidirectionalShadowingMasking(
	vec3 view, vec3 dir, vec3 hw, vec3 normal, float sharpness, float gtrGamma) {
	return getGGXMonodirectionalShadowing(view, hw, normal, sharpness, gtrGamma)
		* getGGXMonodirectionalShadowing(dir, hw, normal, sharpness, gtrGamma);
}

float getGTRAnisotropy(float anisotropy) {
	float anisoAbs = abs(anisotropy);
	if (anisoAbs >= 1e-12f && anisoAbs < 1.0f - 1e-6f) {
		if (anisotropy > 0.0f) {
			return 1.0f / (1.0f - anisotropy);
		} else {
			return 1.0f + anisotropy;
		}
	} else {
		return 1.0f;
	}
}

float getGGXContribution(
	vec3 view,
	vec3 dir,
	vec3 hw,
	vec3 hl,
	float sharpness,
	float gtrGamma,
	mat3 nm,
	float anisotropy,
	out float partialProb,
	out float D
) {
	float cosIN = abs(dot(view, nm[2]));
	float cosON = abs(dot(dir, nm[2]));
	float hn = hl.z;
	float ho = dot(hw, dir);

	if (cosIN <= 1e-6 || cosON <= 1e-6 || hn <= 1e-6f || ho <= 1e-6f)
		return 0.0;

	float normalization = 1.0f;
	vec3 hAnisoLocal, hAniso, lAniso, vAniso, nAniso;
	if (anisotropy != 0.0f && anisotropy != 1.0f) {
		hAnisoLocal = vec3(1.0f / anisotropy, anisotropy, 1.0f) * hl;
		normalization = 1.0f / dot(hAnisoLocal, hAnisoLocal);
		hAnisoLocal *= sqrt(normalization);
		normalization = sqr(normalization);

		// The new anisotropy computes the shadowing-masking in local space.
		// The view and light direction are transformed with the inverse compared to the half vector,
		// because normals are transformed with the inverse transposed of the matrix used to transform the directions.
		vAniso = view * nm; // multiplying from the left is equivalent to multiplying with inm.
		vAniso = normalize(vec3(anisotropy, 1.0f / anisotropy, 1.0f) * vAniso);

		lAniso = dir * nm; // multiplying from the left is equivalent to multiplying with inm.
		lAniso = normalize(vec3(anisotropy, 1.0f / anisotropy, 1.0f) * lAniso);

		hAniso = hAnisoLocal;
		nAniso = vec3(0.0f, 0.0f, 1.0f);
	} else {
		hAnisoLocal = hl;
		hAniso = hw;
		vAniso = view;
		lAniso = dir;
		nAniso = nm[2];
	}

	// Output param
	D = getGGXMicrofacetDistribution(hAnisoLocal.z, sharpness, gtrGamma) * normalization;

	// division by cosON is omitted because we would have to multiply by the same below
	float partialBrdf = 0.25 * getGGXBidirectionalShadowingMasking(vAniso, lAniso, hAniso, nAniso, sharpness, gtrGamma) / cosIN;

	// Output param
	// The probability without the microfacet distribution Dval and V-Ray factor 2pi.
	partialProb = 0.25f * hn / ho;

	// reduce some multiplications in the final version
	// partialBrdf *= cosON; - omitted

	return partialBrdf;

}

vec3 getGGXDir(float u, float v, float sharpness, float gtrGamma, vec3 view, mat3 nm, float anisotropy, out float prob, out float brdfDivByProb) {
	vec3 microNormalLocal = getGGXMicroNormal(u, v, sharpness, gtrGamma);
	if (microNormalLocal.z < 0.0)
		return nm[2];

	if (anisotropy != 0.0f && anisotropy != 1.0f) {
		microNormalLocal = normalize(microNormalLocal * vec3(anisotropy, 1.0f / anisotropy, 1.0f));
	}

	vec3 microNormal = nm * microNormalLocal;

	vec3 dir = reflect(-view, microNormal);

	float D = 0.0;
	float partialProb = 0.0;
	float partialBrdf = getGGXContribution(view, dir, microNormal, microNormalLocal, sharpness, gtrGamma, nm, anisotropy, partialProb, D);
	prob = (D >= 1e-6) ? partialProb * D * 2.0 * PI : LARGE_FLOAT; // compute full probability and apply vray specific corrections
	brdfDivByProb = (partialProb >= 1e-6) ? partialBrdf / partialProb : 0.0;
	return dir;
}

vec3 sampleBRDF(
	VRayMtlInitParams params, VRayMtlContext ctx, int sampleIdx, int nbSamples, out float rayProb, out float brdfContrib) {
	vec3 geomNormal = ctx.geomNormal;
	float ggxTail = params.gtrGamma;
	vec2 uv = rand(ctx, sampleIdx, nbSamples);
	float u = uv.x, v = uv.y;

	rayProb = 1.0;
	brdfContrib = 1.0;
    vec3 dir = getGGXDir(u, v, ctx.roughnessSqr, ctx.gtrGamma, -ctx.e, ctx.nm, ctx.anisotropy, rayProb, brdfContrib);

	if (dot(dir, geomNormal) < 0.0) {
		brdfContrib = 0.0;
	}
	return dir;
}

vec3 sampleRefractBRDF(
	VRayMtlInitParams params, VRayMtlContext ctx, int sampleIdx, int nbSamples, out bool totalInternalReflection) {
	vec3 geomNormal = ctx.geomNormal;
	vec3 refractDir = refract(ctx.e, geomNormal, 1.0 / params.refractionIOR);
	totalInternalReflection = false;
	if (refractDir == vec3(0.0)) {
		refractDir = reflect(ctx.e, geomNormal);
		totalInternalReflection = true;
	}

	vec3 s = cross(vec3(0, 1, 0), refractDir);
	vec3 s1 = cross(refractDir, s);
	mat3 m;
	m[0] = normalize(s);
	m[1] = normalize(s1);
	m[2] = normalize(refractDir);

	vec2 uv = rand(ctx, sampleIdx, nbSamples);
	float u = uv.x, v = uv.y;
	float gloss = 1.0 / pow(max(1.0 - params.refrGloss, 1e-4), 3.5) - 1.0;
	vec3 sampleDir = getSpecularDir(u, v, gloss);

	return m * sampleDir;
}

vec3 sampleDiffuseBRDF(VRayMtlInitParams params, VRayMtlContext ctx, int sampleIdx, int nbSamples, out float rayProb, out float brdfContrib) {
	// Sample the hemisphere with cosine distribution
	mat3 localToWorld;
	makeNormalMatrix(ctx.geomNormal, localToWorld);
	vec2 uv = rand(ctx, sampleIdx, nbSamples);
	vec3 dir = localToWorld * getDiffuseDir(uv.x, uv.y);
	rayProb = INV_2PI;
	brdfContrib = 1.0;
	return dir;
}

float pow35(float x) {
	return x * x * x * sqrt(x);
}

/// Artist-Friendly Metallic Fresnel by Ole Gulbrandsen. Works by trying to estimate the n and k values with some plausible
/// formula and then using those n and k values to compute the Fresnel effect. See
/// http://jcgt.org/published/0003/04/03/paper.pdf for more information.
/// Compute the complex index of refraction n+ik based on the reflectivity r and the edgetint g.
/// @param[in] r Reflectivity
/// @param[in] g Edgetint
/// @param[out] n Refractive index
/// @param[out] k2 Extinction coefficient squared
void getOleNK2(vec3 r, vec3 g, out vec3 n, out vec3 k2) {
	vec3 rClamped = min(r, vec3(0.9999f));
	vec3 rSqrt = sqrt(rClamped);
	vec3 nMin = (1.0 - rClamped) / (1.0 + rClamped);
	vec3 nMax = (1.0 + rSqrt) / (1.0 - rSqrt);
	n = mix(nMax, nMin, g);
	k2 = ((n + 1.0) * (n + 1.0f) * rClamped - (n - 1.0) * (n - 1.0)) / (1.0 - rClamped);
}

/// Use an accurate Fresnel formula for conductors to compute reflections from metals (metalness > 0).
/// @param diffuseColor The color of the diffuse layer.
/// @param reflectionColor The color of the reflection layer.
/// @param metalness Controls the reflection from dielectric - 0, to metallic - 1.
/// @param viewDir Normalized direction towards the camera.
/// @param outDir Normalized direction towards the light source.
/// @param dielectricFresnel Dielectric Fresnel used for blending with the conductor Fresnel.
/// @param thinFilmThickness Thin film thickness in nanometers.
/// @param thinFilmIOR IOR of the thin film layer.
/// @return Blended reflection color.
vec3 computeMetallicReflection(
	vec3 diffuseColor,
	vec3 reflectionColor,
	float metalness,
	vec3 viewDir,
	vec3 outDir,
	vec3 dielectricFresnel,
	float thinFilmThickness,
	float thinFilmIOR
) {
	vec3 conductorIOR;
	vec3 conductorExtinction2;
	// Compute the complex index of refraction using Ole Gulbrandsen's remapping of reflectivity and edgetint colors.
	getOleNK2(diffuseColor, reflectionColor, conductorIOR, conductorExtinction2);

	vec3 h = normalize(outDir + viewDir);
	float cosIn = dot(viewDir, h);
	vec3 dielectricColor = dielectricFresnel * reflectionColor;
	vec3 conductorColor = getFresnelConductorWithThinFilm(
		conductorIOR,
		conductorExtinction2,
		cosIn,
		thinFilmThickness,
		thinFilmIOR
	);

	return mix(dielectricColor, conductorColor, metalness);
}

VRayMtlContext initVRayMtlContext(VRayMtlInitParams initParams) {
	float reflGloss = initParams.reflGloss;
	vec3 Vw = initParams.Vw;
	vec3 geomNormal = initParams.geomNormal;
	vec3 selfIllum = initParams.selfIllum;
	vec3 diffuseColor = initParams.diffuseColor;
	float diffuseAmount = initParams.diffuseAmount;
	vec3 reflColor = initParams.reflColor;
	float reflAmount = initParams.reflAmount;
	bool traceReflections = initParams.traceReflections;
	float metalness = initParams.metalness;
	float aniso = initParams.aniso;
	float anisoRotation = initParams.anisoRotation;
	int anisoAxis = initParams.anisoAxis;
	vec3 opacity = initParams.opacity;
	float roughness = initParams.roughness;
	vec3 refractionColor = initParams.refractionColor;
	float refractionAmount = initParams.refractionAmount;
	bool traceRefractions = initParams.traceRefractions;
	float fresnelIOR = initParams.fresnelIOR;
	float refractionIOR = initParams.refractionIOR;
	bool useFresnel = initParams.useFresnel;
	bool lockFresnelIOR = initParams.lockFresnelIOR;
	bool doubleSided = initParams.doubleSided;
	bool useRoughness = initParams.useRoughness;
	float gtrGamma = initParams.gtrGamma;
	float thinFilmThickness = initParams.thinFilmThickness;
	float thinFilmIOR = initParams.thinFilmIOR;

	VRayMtlContext result;
	if (initParams.lockFresnelIOR)
		initParams.fresnelIOR = initParams.refractionIOR;

	result.e = -normalize(Vw);
	 // Invert glossiness (turn it into roughness)
	if (useRoughness) {
		reflGloss = 1.0 - reflGloss;
	}

	result.reflGloss = reflGloss;
	result.opacity = opacity;
	result.diff = diffuseColor * diffuseAmount * result.opacity;
	result.illum = selfIllum * result.opacity;
	// roughness
	float sqrRough = roughness * roughness;
	result.rtermA = 1.0 - 0.5 * (sqrRough / (sqrRough + 0.33));
	result.rtermB = 0.45 * (sqrRough / (sqrRough + 0.09));

	bool backside = dot(geomNormal, result.e) > 0.0;
	if (doubleSided && backside)
		geomNormal = -geomNormal;

	result.geomNormal = geomNormal;

	// If the Fresnel IOR is less than 1.0, but the refraction IOR is greater than 1.0, use the inverse because IOR maps are typically 0-1.
	if (fresnelIOR > 1e-6 && fresnelIOR < 1.0 && refractionIOR >= 1.0) {
		fresnelIOR = 1.0 / fresnelIOR;
	}

	bool internalReflection;
	vec3 refractDir = computeRefractDir(fresnelIOR, refractionIOR, result.e, geomNormal, internalReflection);
	float cosIn = -dot(result.e, geomNormal);
	float cosR = -dot(refractDir, geomNormal);

	// If the Thin Film IOR is less than 1.0, but the refraction IOR is greater than 1.0, use the inverse because IOR maps are typically 0-1.
	if (thinFilmIOR > 1e-6 && thinFilmIOR < 1.0 && refractionIOR >= 1.0) {
		thinFilmIOR = 1.0 / thinFilmIOR;
	}

	vec3 fresnel = vec3(1.0f);
	if (useFresnel && !internalReflection) {
		// Compute Fresnel coefficients. For front-facing surfaces use the reflection IOR; on back
		// surfaces use the refraction IOR so that it matches the internal reflection.
		float ior = backside ? refractionIOR : fresnelIOR;
		// For front-facing surfaces, only use the reflection IOR.
		// For back surfaces, use the refraction IOR.
		float reflectionIOR = backside ? 1.0f / ior : ior;
		if (cosIn > 1.0 - 1e-12 || cosR > 1.0 - 1e-12) { // View direction is perpendicular to the surface
			float f = (reflectionIOR - 1.0) / (reflectionIOR + 1.0);
			fresnel = vec3(clamp(f * f, 0.0, 1.0));
		} else {
			fresnel = getFresnelCoeffWithThinFilm(cosIn, reflectionIOR, thinFilmThickness, thinFilmIOR);
		}
	}

	vec3 reflNoFresnel = reflColor * reflAmount * result.opacity;
	result.refl = reflNoFresnel * fresnel;

	vec3 dielectricReflectionTransparency = traceReflections ? (1.0 - result.refl) : vec3(1.0);
	vec3 reflectionTransparency = (1.0 - metalness) * dielectricReflectionTransparency;
	if (traceRefractions) {
		result.refr = refractionColor * refractionAmount * result.opacity * reflectionTransparency;
	} else {
		result.refr = vec3(0.0);
	}

	if (metalness > 1e-6f) {
		vec3 outDir = reflect(result.e, geomNormal);
		result.refl = computeMetallicReflection(
			result.diff,
			reflNoFresnel,
			metalness,
			-result.e,
			outDir,
			fresnel,
			thinFilmThickness,
			thinFilmIOR
		);
	}

	result.diff *= reflectionTransparency - result.refr;

	result.gloss1 = max(0.0, 1.0 / pow35(max(1.0 - reflGloss, 1e-4)) - 1.0); // [0, 1] -> [0, inf)
	result.roughnessSqr = max(1.0 - reflGloss, 1e-4);
	result.roughnessSqr *= result.roughnessSqr;
	result.gtrGamma = gtrGamma;

	// Set up the normal/inverse normal matrices for BRDFs that support anisotropy
	vec3 anisoDirection = vec3(0.0, 0.0, 1.0);
	if (anisoAxis == 0)
		anisoDirection = vec3(1.0, 0.0, 0.0);
	else if (anisoAxis == 1)
		anisoDirection = vec3(0.0, 1.0, 0.0);
	float anisoAbs = abs(aniso);
	if (anisoAbs < 1e-12 || anisoAbs >= 1.0 - 1e-6 || internalReflection) {
		makeNormalMatrix(geomNormal, result.nm);
		result.inm = transpose(result.nm); // inverse = transpose for orthogonal matrix
	} else {
		vec3 base0, base1;
		base0 = normalize(cross(geomNormal, anisoDirection));
		base1 = normalize(cross(base0, geomNormal));
		float anisor = anisoRotation * 6.2831853;
		if (abs(anisor) > 1e-6) {
			float cs = cos(anisor);
			float sn = sin(anisor);
			vec3 nu = base0 * cs - base1 * sn;
			vec3 nv = base0 * sn + base1 * cs;
			base0 = nu;
			base1 = nv;
		}

		if (length(cross(base0, base1)) < 1e-6)
			computeTangentVectors(geomNormal, base0, base1);

        result.nm = mat3(base0, base1, geomNormal);
        result.inm = transpose(result.nm);
        result.anisotropy = getGTRAnisotropy(aniso);
	}

	return result;
}

/// Lambertian BRDF contribution
vec3 vrayMtlDiffuse(vec3 lightDir, vec3 normal) {
	return vec3(max(0.0, dot(lightDir, normal)));
}

/// Oren-Nayar BRDF contribution
vec3 vrayMtlDiffuseRoughness(vec3 lightDir, VRayMtlContext ctx) {
	float lightNdotL = max(0.0, dot(lightDir, ctx.geomNormal));
	float rmult = 1.0;
	vec3 vecV = -ctx.e;
	float NV = clamp(dot(ctx.geomNormal, vecV), 0.0, 1.0);
	float theta_i = acos(lightNdotL);
	float theta_r = acos(NV);
	float alpha = max(theta_i, theta_r);
	if (alpha > 1.571) { // 1.571==pi/2
		rmult = 0.0;
	} else {
		float beta = min(theta_i, theta_r);
		vec3 vecVtan = vecV - ctx.geomNormal * NV;
		vec3 vecLtan = lightDir - ctx.geomNormal * lightNdotL;
		float fMult = length(vecVtan) * length(vecLtan);
		float cosDeltaPhi = fMult < 0.000001 ? 1.0 : dot(vecVtan, vecLtan) / fMult;
		rmult = (ctx.rtermA + ctx.rtermB * sin(alpha) * tan(beta) * max(0.0, cosDeltaPhi));
	}
	return vec3(lightNdotL * rmult);
}

/// GTR BRDF contribution
vec3 vrayMtlGGX(vec3 lightDir, VRayMtlContext ctx) {
	float cs1 = -dot(ctx.e, ctx.geomNormal);
	float lightNdotL = dot(ctx.geomNormal, lightDir);
	if (lightNdotL > 1e-6 && cs1 > 1e-6) {
		vec3 hw = normalize(lightDir - ctx.e);
		vec3 hl = normalize(ctx.inm * hw);
		float D = 0.0f;
		float partialProb = 0.0f;
		float partialBrdf = getGGXContribution(-ctx.e, lightDir, hw, hl, ctx.roughnessSqr, ctx.gtrGamma, ctx.nm, ctx.anisotropy, partialProb, D);

		// compute full brdf and probability, and apply vray specific corrections
		float fullBrdf = partialBrdf * D * PI;
		return vec3(fullBrdf);
	}
	return vec3(0.0);
}

vec3 computeDirectDiffuseContribution(VRayMtlInitParams params, VRayMtlContext ctx, vec3 lightDir) {
	vec3 res = vec3(0.0);
	if (params.roughness < 1e-6) {
		res = vrayMtlDiffuse(lightDir, ctx.geomNormal);
	} else {
		res = vrayMtlDiffuseRoughness(lightDir, ctx);
	}

	return res;
}

vec3 computeDirectReflectionContribution(VRayMtlInitParams params, VRayMtlContext ctx, vec3 lightDir) {
	return vrayMtlGGX(lightDir, ctx);
}

vec3 computeIndirectDiffuseContribution(VRayMtlInitParams params, VRayMtlContext ctx) {
	return engEnvIrradiance(params.geomNormal);
}

vec3 computeIndirectReflectionContribution(VRayMtlInitParams params, VRayMtlContext ctx) {
	vec3 res = vec3(0.0);

	if (!params.traceReflections)
		return res;

	int numSamples = NUM_ENV_SAMPLES + int(float(NUM_ENV_SAMPLES_ROUGH) * (params.aniso + 0.5 * ctx.roughnessSqr));
	if (ctx.roughnessSqr < 0.0001)
		numSamples = 1;
	float invNumSamples = 1.0 / float(numSamples);
	vec3 envSum = vec3(0.0);
	for (int i = 0; i < numSamples; ++i) {
		float brdfContrib = 0.0;
		float rayProb = 0.0;
		vec3 dir = sampleBRDF(params, ctx, i, numSamples, rayProb, brdfContrib);
		if (brdfContrib < 1e-6)
			continue;
		float lod = computeEnvLOD(dir, rayProb, numSamples);
		envSum += engTextureEnvMapLOD(dir, lod) * brdfContrib;
	}
	res += envSum * invNumSamples;

	return res;
}

vec3 computeIndirectRefractionContribution(
	VRayMtlInitParams params, VRayMtlContext ctx, float alpha, vec3 alphaDir) {
	vec3 res = vec3(0.0);

	if (!params.traceRefractions)
		return res;

	int numSamples = NUM_ENV_SAMPLES + int(float(NUM_ENV_SAMPLES_ROUGH) * params.refrGloss);
	float invNumSamples = 1.0 / float(numSamples);
	vec3 view = -params.Vw;

	if (alpha <= 0.999) {
		res += engTextureEnvMapLOD(alphaDir, 0.0);
	} else {
		vec3 envSum = vec3(0.0);
		for (int i = 0; i < numSamples; ++i) {
			bool totalInternalReflection;
			vec3 dir = sampleRefractBRDF(params, ctx, i, numSamples, totalInternalReflection);
			if (totalInternalReflection) {
				envSum += engTextureEnvMapLOD(dir, 0.0);
			} else {
				envSum += engTextureEnvMapLOD(dir, 0.0);
			}
		}
		res += envSum * invNumSamples;
	}

	return res;
}

//////////////////////////////////////////////////////////////////////
// End of VRayMtl implementation.
//////////////////////////////////////////////////////////////////////


vec3 shade(
  vec3 normal,
  vec3 eyeDir,
  vec3 lightDir,
  float sweepFactor,
  float fragmentNoise,
  vec2 uv,
  vec3 basecolor,
  float roughness,
  float metalness,
  float alpha
) {
  // VRayMtl initialisation from defaults
  VRayMtlInitParams initParams;
  initParams.Vw = normalize(eyeDir);
  initParams.geomNormal = normal;
  initParams.diffuseAmount = 1.0;
  initParams.selfIllum = vec3(0);
  initParams.reflAmount = 1.0;
  initParams.traceReflections = true;
  initParams.aniso = 0.0;
  initParams.anisoRotation = 0.0;
  initParams.anisoAxis = 2;
  initParams.refractionColor = vec3(0.0, 0.0, 0.0);
  initParams.refractionAmount = 1.0;
  initParams.refrGloss = 1.0;
  initParams.refractionIOR = 1.6;
  initParams.traceRefractions = true;
  initParams.useFresnel = true;
  initParams.fresnelIOR = 1.6;
  initParams.lockFresnelIOR = true;
  initParams.doubleSided = true;
  initParams.gtrGamma = 2.0;
  initParams.thinFilmThickness = 0.0;
  initParams.thinFilmIOR = 1.47;

  // VRayMtl initialisation from texture values
  initParams.useRoughness = true;
  initParams.metalness = metalness;
  initParams.roughness = roughness;
  initParams.reflGloss = roughness;
  initParams.diffuseColor = basecolor;
  initParams.reflColor = basecolor;
  initParams.opacity = vec3(alpha);

  // Initialise context and generate response
  VRayMtlContext ctx = initVRayMtlContext(initParams);
  ctx.fragmentNoise = fragmentNoise;
  vec3 diffuseDirect = computeDirectDiffuseContribution(initParams, ctx, lightDir);
  vec3 diffuseIndirect = computeIndirectDiffuseContribution(initParams, ctx);
  vec3 diffuse = diffuseDirect + diffuseIndirect;
  vec3 reflDirect = computeDirectReflectionContribution(initParams, ctx, lightDir);
  vec3 reflIndirect = computeIndirectReflectionContribution(initParams, ctx);
  vec3 reflection = reflDirect + reflIndirect;
  vec3 refraction = computeIndirectRefractionContribution(initParams, ctx, alpha, -initParams.Vw);

  return (
    diffuse * ctx.diff
    + reflection * ctx.refl
    + ctx.illum
    + refraction * ctx.refr
  );
}

#undef PI
`;

export default VRayMtlFragShader;


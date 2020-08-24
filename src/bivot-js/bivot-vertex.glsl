precision highp float;
precision highp int;
#define HIGH_PRECISION
#define SHADER_NAME ShaderMaterial
#define USE_NORMALMAP 1
#define VERTEX_TEXTURES
#define GAMMA_FACTOR 1.8
#define MAX_BONES 0
#define BONE_TEXTURE
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
#ifdef USE_TANGENT
	attribute vec4 tangent;
#endif
#ifdef USE_COLOR
	attribute vec3 color;
#endif
#ifdef USE_MORPHTARGETS
	attribute vec3 morphTarget0;
	attribute vec3 morphTarget1;
	attribute vec3 morphTarget2;
	attribute vec3 morphTarget3;
	#ifdef USE_MORPHNORMALS
		attribute vec3 morphNormal0;
		attribute vec3 morphNormal1;
		attribute vec3 morphNormal2;
		attribute vec3 morphNormal3;
	#else
		attribute vec3 morphTarget4;
		attribute vec3 morphTarget5;
		attribute vec3 morphTarget6;
		attribute vec3 morphTarget7;
	#endif
#endif
#ifdef USE_SKINNING
	attribute vec4 skinIndex;
	attribute vec4 skinWeight;
#endif


    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    void main() {
      vec4 worldPosition = modelMatrix*vec4(position, 1.0);

      vUv = uv;
      // Alternatively this might be needed if we are scaling the texture:
      // vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif
vec3 transformedNormal = normalMatrix * objectNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	vec3 transformedTangent = normalMatrix * objectTangent;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif

      vNormal = normalize(transformedNormal);

vec3 transformed = vec3( position );
vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
gl_Position = projectionMatrix * mvPosition;

      vViewPosition = - mvPosition.xyz;
    }
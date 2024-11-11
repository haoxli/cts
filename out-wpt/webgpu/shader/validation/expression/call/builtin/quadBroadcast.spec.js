/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Validation tests for quadBroadcast
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  isConvertible,
  Type,
  elementTypeOf,
  kAllScalarsAndVectors } from
'../../../../../util/conversion.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('requires_subgroups').
desc('Validates that the subgroups feature is required').
params((u) => u.combine('enable', [false, true])).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('subgroups');
}).
fn((t) => {
  const wgsl = `
${t.params.enable ? 'enable subgroups;' : ''}
fn foo() {
  _ = quadBroadcast(0, 0);
}`;

  t.expectCompileResult(t.params.enable, wgsl);
});

g.test('requires_subgroups_f16').
desc('Validates that the subgroups feature is required').
params((u) => u.combine('enable', [false, true])).
beforeAllSubcases((t) => {
  const features = ['shader-f16', 'subgroups'];
  if (t.params.enable) {
    features.push('subgroups-f16');
  }
  t.selectDeviceOrSkipTestCase(features);
}).
fn((t) => {
  const wgsl = `
enable f16;
enable subgroups;
${t.params.enable ? 'enable subgroups_f16;' : ''}
fn foo() {
  _ = quadBroadcast(0h, 0);
}`;

  t.expectCompileResult(t.params.enable, wgsl);
});

const kArgumentTypes = objectsToRecord(kAllScalarsAndVectors);

const kStages = {
  constant: `
enable subgroups;
@compute @workgroup_size(16)
fn main() {
  const x = quadBroadcast(0, 0);
}`,
  override: `
enable subgroups;
override o = quadBroadcast(0, 0);`,
  runtime: `
enable subgroups;
@compute @workgroup_size(16)
fn main() {
  let x = quadBroadcast(0, 0);
}`
};

g.test('early_eval').
desc('Ensures the builtin is not able to be compile time evaluated').
params((u) => u.combine('stage', keysOf(kStages))).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('subgroups');
}).
fn((t) => {
  const code = kStages[t.params.stage];
  t.expectCompileResult(t.params.stage === 'runtime', code);
});

g.test('must_use').
desc('Tests that the builtin has the @must_use attribute').
params((u) => u.combine('must_use', [true, false])).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('subgroups');
}).
fn((t) => {
  const wgsl = `
enable subgroups;
@compute @workgroup_size(16)
fn main() {
  ${t.params.must_use ? '_ = ' : ''}quadBroadcast(0, 0);
}`;

  t.expectCompileResult(t.params.must_use, wgsl);
});

g.test('data_type').
desc('Validates data parameter type').
params((u) => u.combine('type', keysOf(kArgumentTypes))).
beforeAllSubcases((t) => {
  const features = ['subgroups'];
  const type = kArgumentTypes[t.params.type];
  if (type.requiresF16()) {
    features.push('subgroups-f16');
    features.push('shader-f16');
  }
  t.selectDeviceOrSkipTestCase(features);
}).
fn((t) => {
  const type = kArgumentTypes[t.params.type];
  let enables = `enable subgroups;\n`;
  if (type.requiresF16()) {
    enables += `enable subgroups_f16;\nenable f16;`;
  }
  const wgsl = `
${enables}
@compute @workgroup_size(1)
fn main() {
  _ = quadBroadcast(${type.create(0).wgsl()}, 0);
}`;

  t.expectCompileResult(elementTypeOf(type) !== Type.bool, wgsl);
});

g.test('return_type').
desc('Validates data parameter type').
params((u) =>
u.
combine('dataType', keysOf(kArgumentTypes)).
combine('retType', keysOf(kArgumentTypes)).
filter((t) => {
  const retType = kArgumentTypes[t.retType];
  const retEleTy = elementTypeOf(retType);
  const dataType = kArgumentTypes[t.dataType];
  const dataEleTy = elementTypeOf(dataType);
  return (
    retEleTy !== Type.abstractInt &&
    retEleTy !== Type.abstractFloat &&
    dataEleTy !== Type.abstractInt &&
    dataEleTy !== Type.abstractFloat);

})
).
beforeAllSubcases((t) => {
  const features = ['subgroups'];
  const dataType = kArgumentTypes[t.params.dataType];
  const retType = kArgumentTypes[t.params.retType];
  if (dataType.requiresF16() || retType.requiresF16()) {
    features.push('subgroups-f16');
    features.push('shader-f16');
  }
  t.selectDeviceOrSkipTestCase(features);
}).
fn((t) => {
  const dataType = kArgumentTypes[t.params.dataType];
  const retType = kArgumentTypes[t.params.retType];
  let enables = `enable subgroups;\n`;
  if (dataType.requiresF16() || retType.requiresF16()) {
    enables += `enable subgroups_f16;\nenable f16;`;
  }
  const wgsl = `
${enables}
@compute @workgroup_size(1)
fn main() {
  let res : ${retType.toString()} = quadBroadcast(${dataType.create(0).wgsl()}, 0);
}`;

  const expect = elementTypeOf(dataType) !== Type.bool && dataType === retType;
  t.expectCompileResult(expect, wgsl);
});

g.test('id_type').
desc('Validates id parameter type').
params((u) => u.combine('type', keysOf(kArgumentTypes))).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('subgroups');
}).
fn((t) => {
  const type = kArgumentTypes[t.params.type];
  const wgsl = `
enable subgroups;
@compute @workgroup_size(1)
fn main() {
  _ = quadBroadcast(0, ${type.create(0).wgsl()});
}`;

  const expect = isConvertible(type, Type.u32) || isConvertible(type, Type.i32);
  t.expectCompileResult(expect, wgsl);
});

const kIdCases = {
  const_decl: {
    code: 'const_decl',
    valid: true
  },
  const_literal: {
    code: '0',
    valid: true
  },
  const_expr: {
    code: 'const_decl + 2',
    valid: true
  },
  let_decl: {
    code: 'let_decl',
    valid: false
  },
  override_decl: {
    code: 'override_decl',
    valid: false
  },
  var_func_decl: {
    code: 'var_func_decl',
    valid: false
  },
  var_priv_decl: {
    code: 'var_priv_decl',
    valid: false
  }
};

g.test('id_constness').
desc('Validates that id must be a const-expression').
params((u) => u.combine('value', keysOf(kIdCases))).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('subgroups');
}).
fn((t) => {
  const wgsl = `
enable subgroups;
override override_decl : u32;
var<private> var_priv_decl : u32;
fn foo() {
  var var_func_decl : u32;
  let let_decl = var_func_decl;
  const const_decl = 0u;
  _ = quadBroadcast(0, ${kIdCases[t.params.value].code});
}`;

  t.expectCompileResult(kIdCases[t.params.value].valid, wgsl);
});

g.test('stage').
desc('Validates it is only usable in correct stage').
params((u) => u.combine('stage', ['compute', 'fragment', 'vertex'])).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('subgroups');
}).
fn((t) => {
  const compute = `
@compute @workgroup_size(1)
fn main() {
  foo();
}`;

  const fragment = `
@fragment
fn main() {
  foo();
}`;

  const vertex = `
@vertex
fn main() -> @builtin(position) vec4f {
  foo();
  return vec4f();
}`;

  const entry = { compute, fragment, vertex }[t.params.stage];
  const wgsl = `
enable subgroups;
fn foo() {
  _ = quadBroadcast(0, 0);
}

${entry}
`;

  t.expectCompileResult(t.params.stage !== 'vertex', wgsl);
});
// v-0007 - fails because 'f' is not a struct.

[[stage(vertex)]]
fn main() {
  var f : f32;
  f.a = 4.0;
  return;
}

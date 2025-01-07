mod other;

fn is_odd(a: i64) -> bool {
    if a % 2 == 0 {
        return false;
    } else {
        return true;
    }
}

#[cfg(feature = "feature_a")]
fn in_feature_a() -> u64 {
    42
}

#[cfg(feature = "feature_b")]
fn in_feature_b() -> u64 {
    23
}

fn main() {
    println!("Hello, world!");
    if is_odd(1) {
        println!("Odd!");
    }

    #[cfg(feature = "feature_a")]
    println!("In feature a: {}", in_feature_a());
    #[cfg(feature = "feature_b")]
    println!("In feature b: {}", in_feature_b());
}

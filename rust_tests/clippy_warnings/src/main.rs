mod other;

fn is_odd(a: i64) -> bool {
    if a % 2 == 0 {
        return false;
    } else {
        return true;
    }
}

fn main() {
    println!("Hello, world!");
    if is_odd(1) {
        println!("Odd!");
    }
}

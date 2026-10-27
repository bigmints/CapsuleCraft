fn main() {
    #[cfg(windows)]
    {
        let mut res = winres::WindowsResource::new();
        res.set_icon("assets/icon.ico");
        res.set("ProductName", "CapsuleCraft");
        res.set("FileDescription", "CapsuleCraft Native Client");
        res.set("LegalCopyright", "Copyright (c) CapsuleCraft contributors");
        if let Err(e) = res.compile() {
            eprintln!("cargo:warning=Failed to compile Windows resources: {e}");
        }
    }
}

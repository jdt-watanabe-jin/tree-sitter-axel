import XCTest
import SwiftTreeSitter
import TreeSitterAxel

final class TreeSitterAxelTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_axel())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Axel grammar")
    }
}

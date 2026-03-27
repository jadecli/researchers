cmake_minimum_required(VERSION 3.20)
project(extractors_cpp VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(LibXml2 REQUIRED)

# Main library
add_library(extractor
    src/extractor.cpp
    src/quality_scorer.cpp
)

target_include_directories(extractor
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE
        ${LIBXML2_INCLUDE_DIR}
)

target_link_libraries(extractor
    PRIVATE
        ${LIBXML2_LIBRARIES}
)

# Tests
option(BUILD_TESTS "Build tests" ON)
if(BUILD_TESTS)
    find_package(GTest)
    if(GTest_FOUND)
        enable_testing()

        add_executable(test_extractor tests/test_extractor.cpp)
        target_link_libraries(test_extractor
            PRIVATE
                extractor
                GTest::GTest
                GTest::Main
                ${LIBXML2_LIBRARIES}
        )
        target_include_directories(test_extractor
            PRIVATE
                ${CMAKE_CURRENT_SOURCE_DIR}/include
                ${LIBXML2_INCLUDE_DIR}
        )

        add_test(NAME ExtractorTests COMMAND test_extractor)
    endif()
endif()

import { setActivePinia, createPinia } from "pinia";

import { useWorkflowStepStore } from "@/stores/workflowStepStore";
import {
    terminalFactory,
    InputCollectionTerminal,
    InputTerminal,
    InputParameterTerminal,
    OutputCollectionTerminal,
    OutputTerminal,
    OutputParameterTerminal,
    producesAcceptableDatatype,
    InvalidOutputTerminal,
} from "./terminals";
import { testDatatypesMapper } from "@/components/Datatypes/test_fixtures";
import { useConnectionStore } from "@/stores/workflowConnectionStore";
import type { DataOutput, Steps } from "@/stores/workflowStepStore";
import { NULL_COLLECTION_TYPE_DESCRIPTION } from "./collectionTypeDescription";
import { simpleSteps, advancedSteps } from "../test_fixtures";

function setupAdvanced() {
    const terminals: { [index: string]: { [index: string]: ReturnType<typeof terminalFactory> } } = {};
    Object.values(advancedSteps).map((step) => {
        const stepLabel = step.label;
        if (stepLabel) {
            terminals[stepLabel] = {};
            step.inputs?.map((input) => {
                terminals[stepLabel][input.name] = terminalFactory(step.id, input, testDatatypesMapper);
            });
            step.outputs?.map((output) => {
                terminals[stepLabel][output.name] = terminalFactory(step.id, output, testDatatypesMapper);
            });
        }
    });
    return terminals;
}

describe("terminalFactory", () => {
    let terminals: { [index: string]: { [index: string]: ReturnType<typeof terminalFactory> } } = {};
    beforeEach(() => {
        setActivePinia(createPinia());
        terminals = setupAdvanced();
    });

    it("constructs correct class instances", () => {
        expect(terminals["data input"]["output"]).toBeInstanceOf(OutputTerminal);
        expect(terminals["simple data"]["input"]).toBeInstanceOf(InputTerminal);
        expect(terminals["simple data"]["out_file1"]).toBeInstanceOf(OutputTerminal);
        expect(terminals["simple data 2"]["input"]).toBeInstanceOf(InputTerminal);
        expect(terminals["simple data 2"]["out_file1"]).toBeInstanceOf(OutputTerminal);
        expect(terminals["multiple simple data"]["input1"]).toBeInstanceOf(InputTerminal);
        expect(terminals["multiple simple data"]["queries_0|input2"]).toBeInstanceOf(InputTerminal);
        expect(terminals["multiple simple data"]["out_file1"]).toBeInstanceOf(OutputTerminal);
        expect(terminals["optional data input"]["output"]).toBeInstanceOf(OutputTerminal);
        expect(terminals["list input"]["output"]).toBeInstanceOf(OutputCollectionTerminal);
        expect(terminals["list:list input"]["output"]).toBeInstanceOf(OutputCollectionTerminal);
        expect(terminals["paired input"]["output"]).toBeInstanceOf(OutputCollectionTerminal);
        expect(terminals["multi data"]["f1"]).toBeInstanceOf(InputTerminal);
        expect(terminals["multi data"]["f2"]).toBeInstanceOf(InputTerminal);
        expect(terminals["multi data"]["out1"]).toBeInstanceOf(OutputTerminal);
        expect(terminals["multi data"]["out2"]).toBeInstanceOf(OutputTerminal);
        expect(terminals["integer parameter input"]["output"]).toBeInstanceOf(OutputParameterTerminal);
        expect(terminals["any collection"]["input"]).toBeInstanceOf(InputCollectionTerminal);
        expect(terminals["any collection"]["output"]).toBeInstanceOf(OutputCollectionTerminal);
        expect(terminals["multi data"]["advanced|advanced_threshold"]).toBeInstanceOf(InputParameterTerminal);
        expect(terminals["list collection input"]["input1"]).toBeInstanceOf(InputCollectionTerminal);
    });
    it("throws error on invalid terminalSource", () => {
        const invalidFactory = () => terminalFactory(1, {} as any, testDatatypesMapper);
        expect(invalidFactory).toThrow();
    });
});

describe("canAccept", () => {
    let terminals: { [index: string]: { [index: string]: ReturnType<typeof terminalFactory> } } = {};
    let stepStore: ReturnType<typeof useWorkflowStepStore>;
    let connectionStore: ReturnType<typeof useConnectionStore>;
    beforeEach(() => {
        setActivePinia(createPinia());
        terminals = setupAdvanced();
        stepStore = useWorkflowStepStore();
        connectionStore = useConnectionStore();
        Object.values(JSON.parse(JSON.stringify(advancedSteps)) as Steps).map((step) => {
            stepStore.addStep(step);
        });
    });

    it("accepts simple data -> data connections", () => {
        const dataOut = terminals["data input"]["output"] as OutputTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        expect(dataIn.canAccept(dataOut).canAccept).toBe(true);
        dataIn.connect(dataOut);
        expect(dataIn.canAccept(dataOut).canAccept).toBe(false);
        dataIn.disconnect(dataOut);
        expect(dataIn.canAccept(dataOut).canAccept).toBe(true);
    });
    it("accepts collection data -> data connection", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        expect(dataIn.mapOver).toBe(NULL_COLLECTION_TYPE_DESCRIPTION);
        expect(dataIn.canAccept(collectionOut).canAccept).toBe(true);
        dataIn.connect(collectionOut);
        expect(dataIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
        expect(dataIn.canAccept(collectionOut).canAccept).toBe(false);
        expect(dataIn.canAccept(collectionOut).reason).toBe("Input already filled with another connection, delete it before connecting another output.");
        dataIn.disconnect(collectionOut);
        expect(dataIn.canAccept(collectionOut).canAccept).toBe(true);
        expect(dataIn.mapOver).toEqual(NULL_COLLECTION_TYPE_DESCRIPTION);
    });
    it("accepts mapped over data output on mapped over data input", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const dataIn = terminals["multiple simple data"]["input1"] as InputTerminal;
        const dataInTwo = terminals["multiple simple data"]["queries_0|input2"] as InputTerminal;
        dataIn.connect(collectionOut);
        expect(dataInTwo.canAccept(collectionOut).canAccept).toBe(true);
    });
    it("accepts list:list data -> data connection", () => {
        const collectionOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        expect(dataIn.mapOver).toBe(NULL_COLLECTION_TYPE_DESCRIPTION);
        expect(dataIn.canAccept(collectionOut).canAccept).toBe(true);
        dataIn.connect(collectionOut);
        expect(dataIn.mapOver).toEqual({ collectionType: "list:list", isCollection: true, rank: 2 });
        expect(dataIn.canAccept(collectionOut).canAccept).toBe(false);
        dataIn.disconnect(collectionOut);
        expect(dataIn.canAccept(collectionOut).canAccept).toBe(true);
        expect(dataIn.mapOver).toEqual(NULL_COLLECTION_TYPE_DESCRIPTION);
    });
    it("treats multi data input as list input", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const multiDataIn = terminals["multi data"]["f1"] as InputTerminal;
        expect(multiDataIn.canAccept(collectionOut).canAccept).toBe(true);
        multiDataIn.connect(collectionOut);
        expect(multiDataIn.mapOver).toBe(NULL_COLLECTION_TYPE_DESCRIPTION);
    });
    it("accepts separate list:list inputs on separate multi-data inputs of same tool", () => {
        const collectionOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const multiDataInOne = terminals["multi data"]["f1"] as InputTerminal;
        const multiDataInTwo = terminals["multi data"]["f2"] as InputTerminal;
        multiDataInOne.connect(collectionOut);
        expect(multiDataInTwo.canAccept(collectionOut).canAccept).toBe(true);
    });
    it("rejects connecting output to input of same step", () => {
        const dataOut = terminals["simple data"]["out_file1"] as OutputTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        expect(dataIn.canAccept(dataOut).canAccept).toBe(false);
        expect(dataIn.canAccept(dataOut).reason).toBe("Cannot connect output to input of same step.");
    });
    it("rejects paired input on multi-data input", () => {
        const multiDataIn = terminals["multi data"]["f1"] as InputTerminal;
        const pairedOut = terminals["paired input"]["output"] as OutputCollectionTerminal;
        expect(multiDataIn.canAccept(pairedOut).canAccept).toBe(false);
        expect(multiDataIn.canAccept(pairedOut).reason).toBe(
            "Cannot attach paired inputs to multiple data parameters, only lists may be treated this way."
        );
    });
    it("rejects collections on multi data inputs if non-collection already connected", () => {
        const multiDataIn = terminals["multi data"]["f1"] as InputTerminal;
        const dataOut = terminals["data input"]["output"] as OutputTerminal;
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        multiDataIn.connect(dataOut);
        expect(multiDataIn.canAccept(collectionOut).canAccept).toBe(false);
        expect(multiDataIn.canAccept(collectionOut).reason).toBe(
            "Cannot attach collections to data parameters with individual data inputs already attached."
        );
    });
    it("maps list:list over multi data input", () => {
        const collectionOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const multiDataIn = terminals["multi data"]["f1"] as InputTerminal;
        expect(multiDataIn.canAccept(collectionOut).canAccept).toBe(true);
        multiDataIn.connect(collectionOut);
        expect(multiDataIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
    });
    it("rejects attaching multiple collections to a single multi data input", () => {
        const collectionOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const otherCollectionOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const multiDataIn = terminals["multi data"]["f1"] as InputTerminal;
        multiDataIn.connect(collectionOut);
        expect(multiDataIn.canAccept(otherCollectionOut).canAccept).toBe(false);
        expect(multiDataIn.canAccept(otherCollectionOut).reason).toBe(
            "Input already filled with another connection, delete it before connecting another output."
        );
    });
    it("rejects data -> collection connection", () => {
        const dataOut = terminals["data input"]["output"] as OutputTerminal;
        const collectionInput = terminals["any collection"]["input"] as InputCollectionTerminal;
        expect(collectionInput.canAccept(dataOut).canAccept).toBe(false);
        expect(collectionInput.canAccept(dataOut).reason).toBe("Cannot attach a data output to a collection input.");
    });
    it("rejects optional data -> required data", () => {
        const optionalDataOut = terminals["optional data input"]["output"] as OutputTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        expect(dataIn.canAccept(optionalDataOut).canAccept).toBe(false);
        expect(dataIn.canAccept(optionalDataOut).reason).toBe(
            "Cannot connect an optional output to a non-optional input"
        );
    });
    it("rejects parameter to data connection", () => {
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        // # type system would reject this, but test runtime too
        const integerParam = terminals["integer parameter input"]["output"] as any;
        expect(dataIn.canAccept(integerParam).canAccept).toBe(false);
        expect(dataIn.canAccept(integerParam).reason).toBe("Cannot connect workflow parameter to data input.");
    });
    it("accepts integer parameter to integer parameter connection", () => {
        const integerInputParam = terminals["multi data"]["advanced|advanced_threshold"] as InputParameterTerminal;
        const integerOutputParam = terminals["integer parameter input"]["output"] as OutputParameterTerminal;
        expect(integerInputParam.canAccept(integerOutputParam).canAccept).toBe(true);
    });
    it("rejects text to integer parameter connection", () => {
        const integerInputParam = terminals["multi data"]["advanced|advanced_threshold"] as InputParameterTerminal;
        const textOutputParam = terminals["text parameter input"]["output"] as OutputParameterTerminal;
        expect(integerInputParam.canAccept(textOutputParam).canAccept).toBe(false);
        expect(integerInputParam.canAccept(textOutputParam).reason).toBe(
            "Cannot attach a text parameter to a integer input"
        );
    });
    it("rejects data to parameter connection", () => {
        const dataOut = terminals["data input"]["output"] as OutputTerminal;
        const integerInputParam = terminals["multi data"]["advanced|advanced_threshold"] as InputParameterTerminal;
        expect(integerInputParam.canAccept(dataOut).canAccept).toBe(false);
        expect(integerInputParam.canAccept(dataOut).reason).toBe("Cannot attach a data parameter to a integer input");
    });
    it("rejects increasing map over if output connected to data input", () => {
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        const dataOut = terminals["simple data"]["out_file1"] as OutputTerminal;
        const constrainingDataIn = terminals["simple data 2"]["input"] as InputTerminal;
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        // connect simple data to simple data 2
        constrainingDataIn.connect(dataOut);
        // now we can't connect a collection out to the data input of simple data
        expect(dataIn.canAccept(collectionOut).canAccept).toBe(false);
        expect(dataIn.canAccept(collectionOut).reason).toBe(
            "Can't map over this input with output collection type - an output of this tool is mapped over constraining this input. Disconnect output(s) and retry."
        );
    });
    it("rejects increasing map over to list:list if data is mapped over a list input", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const listListOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        const dataOut = terminals["simple data"]["out_file1"] as OutputTerminal;
        const dataInTwo = terminals["simple data 2"]["input"] as InputTerminal;
        dataIn.connect(collectionOut);
        dataInTwo.connect(dataOut);
        expect(dataIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
        //
        dataIn.disconnect(collectionOut);
        // this is weird and not particularly robust, if you save and reload this will most likely not be constrained
        // TODO: avoid this if possible ...
        expect(dataIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
        expect(dataIn.canAccept(listListOut).canAccept).toBe(false);
        expect(dataIn.canAccept(listListOut).reason).toBe(
            "Can't map over this input with output collection type - this step has outputs defined constraining the mapping of this tool. Disconnect outputs and retry."
        );
    });
    it("rejects attaching non-collection outputs to mapper over inputs", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const simpleDataOut = terminals["data input"]["output"] as OutputTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        const dataOut = terminals["simple data"]["out_file1"] as OutputTerminal;
        const dataInTwo = terminals["simple data 2"]["input"] as InputTerminal;
        dataIn.connect(collectionOut);
        dataInTwo.connect(dataOut);
        expect(dataIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
        //
        dataIn.disconnect(collectionOut);
        // this is weird and not particularly robust, if you save and reload this will most likely not be constrained
        // TODO: avoid this if possible ...
        expect(dataIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
        expect(dataIn.canAccept(simpleDataOut).canAccept).toBe(false);
        expect(dataIn.canAccept(simpleDataOut).reason).toBe(
            "Cannot attach non-collection outputs to mapped over inputs, consider disconnecting inputs and outputs to reset this input's mapping."
        );
    });
    // TODO: test mapOver reset when constraint removed
    it("resets mapOver when constraint is lifted", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        const dataOut = terminals["simple data"]["out_file1"] as OutputTerminal;
        const dataInTwo = terminals["simple data 2"]["input"] as InputTerminal;
        dataIn.connect(collectionOut);
        dataInTwo.connect(dataOut);
        expect(dataIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
        //
        dataIn.disconnect(collectionOut);
        // this is weird and not particularly robust, if you save and reload this will most likely not be constrained
        // TODO: avoid this if possible ...
        expect(dataIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
        dataInTwo.disconnect(dataOut);
        expect(dataIn.mapOver).toEqual(NULL_COLLECTION_TYPE_DESCRIPTION);
    });
    it("rejects connecting incompatible connection types", () => {
        const pairedOut = terminals["paired input"]["output"] as OutputCollectionTerminal;
        const collectionIn = terminals["list collection input"]["input1"] as InputCollectionTerminal;
        expect(collectionIn.canAccept(pairedOut).canAccept).toBe(false);
        expect(collectionIn.canAccept(pairedOut).reason).toBe("Incompatible collection type(s) for attachment.");
    });
    it("rejects mapping over collection input if other inputs have an incompatible map over collection type", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const listListOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const listOneIn = terminals["two list inputs"]["kind|f1"] as InputCollectionTerminal;
        const listTwoIn = terminals["two list inputs"]["kind|f2"] as InputCollectionTerminal;
        listOneIn.connect(listListOut);
        expect(listTwoIn.canAccept(collectionOut).canAccept).toBe(false);
        expect(listTwoIn.canAccept(collectionOut).reason).toBe(
            "Can't map over this input with output collection type - other inputs have an incompatible map over collection type. Disconnect inputs (and potentially outputs) and retry."
        );
    });
    it("rejects mapping over collection input if outputs constrain input to incompatible collection type", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const listListOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const listOneIn = terminals["two list inputs"]["kind|f1"] as InputCollectionTerminal;
        const listTwoIn = terminals["two list inputs"]["kind|f2"] as InputCollectionTerminal;
        const mapOverOut = terminals["two list inputs"]["out1"] as OutputTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        listOneIn.connect(listListOut);
        dataIn.connect(mapOverOut);
        listOneIn.disconnect(listListOut);
        // TODO: this should be possible eventually IMHO
        expect(listTwoIn.canAccept(collectionOut).canAccept).toBe(false);
        expect(listTwoIn.canAccept(collectionOut).reason).toBe(
            "Can't map over this input with output collection type - this step has outputs defined constraining the mapping of this tool. Disconnect outputs and retry."
        );
    });
    it("tracks transitive map over", () => {
        const collectionOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const listListListOut = terminals["list:list:list input"]["output"] as OutputCollectionTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        const simpleDataOut = terminals["simple data"]["out_file1"] as OutputTerminal;
        dataIn.connect(collectionOut);
        expect(dataIn.mapOver).toEqual({ collectionType: "list:list", isCollection: true, rank: 2 });
        const otherDataIn = terminals["multi data"]["f1"] as InputTerminal;
        expect(otherDataIn.canAccept(simpleDataOut).canAccept).toBe(true);
        otherDataIn.connect(simpleDataOut);
        expect(otherDataIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
        const otherDataInTwo = terminals["multi data"]["f2"] as InputTerminal;
        expect(otherDataInTwo.canAccept(collectionOut).canAccept).toBe(true);
        expect(otherDataInTwo.canAccept(listListListOut).canAccept).toBe(false);
        expect(otherDataInTwo.canAccept(listListListOut).reason).toBe(
            "Can't map over this input with output collection type - other inputs have an incompatible map over collection type. Disconnect inputs (and potentially outputs) and retry."
        );
    });
    it("tracks transitive map over through collection inputs", () => {
        const collectionOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        const collectionIn = terminals["list collection input"]["input1"] as InputCollectionTerminal;
        expect(collectionIn.canAccept(collectionOut).canAccept).toBe(true);
        collectionIn.connect(collectionOut);
        expect(collectionIn.mapOver).toEqual({ collectionType: "list", isCollection: true, rank: 1 });
        const intermediateOut = terminals["list collection input"]["out_file1"] as OutputCollectionTerminal;
        const otherListIn = terminals["list collection input 2"]["input1"] as InputCollectionTerminal;
        expect(otherListIn.canAccept(intermediateOut).canAccept).toBe(true);
        otherListIn.connect(intermediateOut);
        expect(otherListIn.mapOver).toEqual(NULL_COLLECTION_TYPE_DESCRIPTION);
    });
    it("rejects connections to input collection constrained by output connection", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const collectionIn = terminals["list collection input"]["input1"] as InputCollectionTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        const mappedOverListOut = terminals["list collection input"]["out_file1"] as OutputCollectionTerminal;
        const listListOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        // This constrains collectionIn to list because it's output is mapped over
        dataIn.connect(mappedOverListOut);
        collectionIn.connect(collectionOut);
        // Constraint survives disconnect
        collectionIn.disconnect(collectionOut);
        // Can't connect list:list because output acts like "list""
        expect(collectionIn.canAccept(listListOut).canAccept).toBe(false);
        expect(collectionIn.canAccept(listListOut).reason).toBe(
            "Can't map over this input with output collection type - this step has outputs defined constraining the mapping of this tool. Disconnect outputs and retry."
        );
    });
    it("rejects connections to input collection constrained by other input", () => {
        const collectionOut = terminals["list input"]["output"] as OutputCollectionTerminal;
        const dataIn = terminals["simple data"]["input"] as InputTerminal;
        const listOneIn = terminals["two list inputs"]["kind|f1"] as InputCollectionTerminal;
        const listTwoIn = terminals["two list inputs"]["kind|f2"] as InputCollectionTerminal;
        const mapOverOut = terminals["two list inputs"]["out1"] as OutputTerminal;
        const listListOut = terminals["list:list input"]["output"] as OutputCollectionTerminal;
        // This constrains "two list inputs" to list:list because it's output is mapped over
        listOneIn.connect(listListOut);
        dataIn.connect(mapOverOut);
        // Can't connect list as output acts like "list:list"
        expect(listTwoIn.canAccept(collectionOut).canAccept).toBe(false);
        expect(listTwoIn.canAccept(collectionOut).reason).toBe(
            "Can't map over this input with output collection type - other inputs have an incompatible map over collection type. Disconnect inputs (and potentially outputs) and retry."
        );
    });
    it("disconnects invalid input terminals", () => {
        const dataOut = terminals["simple data"]["out_file1"] as OutputTerminal;
        const dataIn = terminals["simple data 2"]["input"] as InputTerminal;
        dataIn.connect(dataOut);
        const oldStep = stepStore.getStep(dataOut.stepId);
        const stepOutput = oldStep.outputs[0] as DataOutput;
        stepOutput["extensions"] = ["ab1"];
        dataOut.datatypes = ["ab1"];
        dataOut.destroyInvalidConnections();
        expect(connectionStore.connections).toEqual([]);
        // disconnects and connection will be invalid
        expect(dataIn.canAccept(dataOut).canAccept).toBe(false);
        expect(dataIn.canAccept(dataOut).reason).toBe(
            "Effective output data type(s) [ab1] do not appear to match input type(s) [txt]."
        );
    });
    it("disconnects invalid output terminals", () => {
        const dataOut = terminals["simple data"]["out_file1"] as OutputTerminal;
        const dataIn = terminals["simple data 2"]["input"] as InputTerminal;
        dataIn.connect(dataOut);
        dataIn.datatypes = ["ab1"];
        dataIn.destroyInvalidConnections();
        expect(connectionStore.connections).toEqual([]);
        // disconnects and connection will be invalid
        expect(dataIn.canAccept(dataOut).canAccept).toBe(false);
        expect(dataIn.canAccept(dataOut).reason).toBe(
            "Effective output data type(s) [tabular] do not appear to match input type(s) [ab1]."
        );
    });
});

describe("Input terminal", () => {
    let stepStore: ReturnType<typeof useWorkflowStepStore>;
    let connectionStore: ReturnType<typeof useConnectionStore>;
    let terminals: { [index: number]: { [index: string]: ReturnType<typeof terminalFactory> } };
    beforeEach(() => {
        setActivePinia(createPinia());
        stepStore = useWorkflowStepStore();
        connectionStore = useConnectionStore();
        terminals = {};
        Object.values(simpleSteps).map((step) => {
            stepStore.addStep(step);
            terminals[step.id] = {};
            const stepTerminals = terminals[step.id];
            step.inputs?.map((input) => {
                stepTerminals[input.name] = terminalFactory(step.id, input, testDatatypesMapper);
            });
            step.outputs?.map((output) => {
                stepTerminals[output.name] = terminalFactory(step.id, output, testDatatypesMapper);
            });
        });
    });

    it("has step", () => {
        expect(stepStore.getStep(1)).toEqual(simpleSteps["1"]);
    });
    it("infers correct state", () => {
        const firstInputTerminal = terminals[1]["input"] as InputTerminal;
        expect(firstInputTerminal).toBeInstanceOf(InputTerminal);
        const dataInputOutputTerminal = terminals[0]["output"] as OutputTerminal;
        expect(dataInputOutputTerminal).toBeInstanceOf(OutputTerminal);
        expect(firstInputTerminal.connections.length).toBe(1);
        expect(firstInputTerminal.mapOver).toBe(NULL_COLLECTION_TYPE_DESCRIPTION);
        expect(firstInputTerminal.isMappedOver()).toBe(false);
        expect(firstInputTerminal.hasConnectedMappedInputTerminals()).toBe(false);
        expect(firstInputTerminal.hasMappedOverInputTerminals()).toBe(false);
        expect(firstInputTerminal.hasConnectedOutputTerminals()).toBe(false);
        const canAccept = firstInputTerminal.canAccept(dataInputOutputTerminal);
        expect(canAccept.canAccept).toBe(false);
        expect(canAccept.reason).toBe(
            "Input already filled with another connection, delete it before connecting another output."
        );
        // bypasses _inputFilled check
        expect(firstInputTerminal.attachable(dataInputOutputTerminal).canAccept).toBe(true);
        expect(firstInputTerminal.connected()).toBe(true);
        expect(firstInputTerminal._collectionAttached()).toBe(false);
        expect(firstInputTerminal._producesAcceptableDatatype(dataInputOutputTerminal).canAccept).toBe(true);
    });
    it("can accept new connection", () => {
        const firstInputTerminal = terminals[1]["input"] as InputTerminal;
        const dataInputOutputTerminal = terminals[0]["output"] as OutputTerminal;
        const connection = firstInputTerminal.connections[0];
        expect(firstInputTerminal.canAccept(dataInputOutputTerminal).canAccept).toBe(false);
        expect(dataInputOutputTerminal.validInputTerminals().length).toBe(0);
        firstInputTerminal.disconnect(connection);
        expect(firstInputTerminal.canAccept(dataInputOutputTerminal).canAccept).toBe(true);
        expect(dataInputOutputTerminal.validInputTerminals().length).toBe(1);
        connectionStore.addConnection(connection);
        expect(firstInputTerminal.canAccept(dataInputOutputTerminal).canAccept).toBe(false);
    });
    it("will maintain invalid connections", () => {
        const connection = connectionStore.connections[0];
        connection.output.name = "I don't exist";
        const firstInputTerminal = terminals[1]["input"] as InputTerminal;
        const invalidTerminals = firstInputTerminal.getConnectedTerminals();
        expect(invalidTerminals.length).toBe(1);
        expect(invalidTerminals[0]).toBeInstanceOf(InvalidOutputTerminal);
    });
});

describe("producesAcceptableDatatype", () => {
    it("accepts everything if datatypes includes input", () => {
        expect(producesAcceptableDatatype(testDatatypesMapper, ["input"], ["whatever"]).canAccept).toBe(true);
    });
    it("rejects connections for unknown output datatypes", () => {
        expect(producesAcceptableDatatype(testDatatypesMapper, ["txt"], ["i am not an extension"]).canAccept).toBe(
            false
        );
        expect(producesAcceptableDatatype(testDatatypesMapper, ["txt"], ["i am not an extension"]).reason).toBe(
            "Effective output data type(s) [i am not an extension] unknown. This tool cannot be run on this Galaxy Server at this moment, please contact the Administrator."
        );
    });
    it("rejects incompatible datatypes", () => {
        expect(producesAcceptableDatatype(testDatatypesMapper, ["txt"], ["ab1"]).canAccept).toBe(false);
        expect(producesAcceptableDatatype(testDatatypesMapper, ["txt"], ["ab1"]).reason).toBe(
            "Effective output data type(s) [ab1] do not appear to match input type(s) [txt]."
        );
    });
});
